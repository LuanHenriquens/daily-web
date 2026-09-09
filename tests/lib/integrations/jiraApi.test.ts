import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDeliveredToday, fetchIssues, jiraBaseUrl } from '@/lib/integrations/jiraApi';
import type { Connection } from '@/lib/vault/connections';

const CONN = {
  id: 'c1',
  module: 'jira',
  label: 'Jira',
  values: { cloud: 'acme', email: 'eu@acme.com', token: 'segredo' },
} as unknown as Connection;

/** Devolve o corpo da última chamada, que é onde a JQL viaja. */
function stubSearch(issues: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ issues }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jqlOf(fetchMock: ReturnType<typeof vi.fn>, call = 0): string {
  return JSON.parse(fetchMock.mock.calls[call][1].body).jql;
}

/** Uma resposta diferente por chamada, na ordem em que `fetchIssues` pergunta:
 *  responsável, relator e aprovação. */
function stubSearchSequence(respostas: unknown[][]) {
  const fetchMock = vi.fn();
  for (const issues of respostas) {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ issues }) });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function issue(key: string, over: Record<string, unknown> = {}) {
  return {
    key,
    fields: {
      summary: `Resumo de ${key}`,
      status: { name: 'Aprovação', statusCategory: { key: 'indeterminate' } },
      project: { key: key.split('-')[0] },
      issuetype: { name: '[System] Service request', subtask: false },
      updated: '2026-09-08T18:00:00.000-0300',
      ...over,
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('jiraBaseUrl', () => {
  it('aceita o nome, o domínio e a URL inteira', () => {
    expect(jiraBaseUrl('acme')).toBe('https://acme.atlassian.net');
    expect(jiraBaseUrl('acme.atlassian.net')).toBe('https://acme.atlassian.net');
    expect(jiraBaseUrl('https://acme.atlassian.net/')).toBe('https://acme.atlassian.net');
  });
});

describe('fetchDeliveredToday', () => {
  // O nome do status final é livre por workflow — aqui é "Resolvido" e
  // "Fechado", em outra instância é "Done". Depender do nome quebraria fora
  // desta instância; a categoria e o histórico de transição, não.
  it('pergunta pelo que você encerrou hoje sem citar nome de status', async () => {
    const fetchMock = stubSearch([]);
    await fetchDeliveredToday(CONN);

    const jql = jqlOf(fetchMock);
    expect(jql).toContain('statusCategory = Done');
    expect(jql).toContain('status CHANGED BY currentUser() DURING (startOfDay(), now())');
    expect(jql).toContain('assignee = currentUser() AND resolved >= startOfDay()');
    expect(jql).not.toMatch(/Resolvido|Fechado|Done"/);
  });

  it('faz uma só ida ao Jira', async () => {
    const fetchMock = stubSearch([]);
    await fetchDeliveredToday(CONN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('traz a issue com a situação e o link de abrir', async () => {
    stubSearch([
      {
        key: 'PDS-10',
        fields: {
          summary: 'Ajuste do cashback',
          status: { name: 'Resolvido', statusCategory: { key: 'done' } },
          project: { key: 'PDS' },
          issuetype: { name: 'História', subtask: false },
          updated: '2026-08-31T18:00:00.000-0300',
        },
      },
    ]);

    const [item] = await fetchDeliveredToday(CONN);
    expect(item.key).toBe('PDS-10');
    expect(item.statusCategory).toBe('done');
    expect(item.status).toBe('Resolvido');
    expect(item.url).toBe('https://acme.atlassian.net/browse/PDS-10');
  });
});

describe('fetchIssues: aguardando a minha aprovação', () => {
  // `approvals = myPending()` é a única forma que a instância aceita
  // (`pendingBy(currentUser())` devolve erro de sintaxe), e é ela que
  // distingue o que espera por você do que apenas está num status chamado
  // "Aprovação" — que pode estar esperando outra pessoa.
  it('pergunta pelas aprovações pendentes sem citar nome de status', async () => {
    const fetchMock = stubSearchSequence([[], [], []]);
    await fetchIssues(CONN, 'both');

    const jql = jqlOf(fetchMock, 2);
    expect(jql).toContain('approvals = myPending()');
    expect(jql).not.toMatch(/status\s*=/);
  });

  it('marca a issue que espera pela sua aprovação', async () => {
    stubSearchSequence([[], [], [issue('PDS-2138')]]);

    const items = await fetchIssues(CONN, 'both');

    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('PDS-2138');
    expect(items[0].awaitingApproval).toBe(true);
  });

  it('não marca aprovação em issue que veio por responsável ou relator', async () => {
    stubSearchSequence([[issue('TT-1')], [issue('TT-2')], []]);

    const items = await fetchIssues(CONN, 'both');

    expect(items.map((i) => i.awaitingApproval)).toEqual([false, false]);
  });

  // Ser o responsável e o aprovador ao mesmo tempo é comum em mudança: a
  // issue é uma só, e sumir com o papel dela ao ganhar o selo seria perder
  // informação que a lista já mostrava.
  it('mantém uma linha só quando a issue também é sua, somando os dois papéis', async () => {
    stubSearchSequence([[issue('PDS-2130')], [], [issue('PDS-2130')]]);

    const items = await fetchIssues(CONN, 'both');

    expect(items).toHaveLength(1);
    expect(items[0].role).toBe('assignee');
    expect(items[0].awaitingApproval).toBe(true);
  });

  // O filtro por papel recorta o que é seu; a aprovação não é um papel seu na
  // issue, e ainda assim precisa aparecer. Buscá-la sempre é o que permite ao
  // painel mostrá-la independentemente do filtro escolhido.
  it('busca as aprovações mesmo quando o filtro é só responsável', async () => {
    const fetchMock = stubSearchSequence([[], []]);
    await fetchIssues(CONN, 'assignee');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(jqlOf(fetchMock, 1)).toContain('approvals = myPending()');
  });
});
