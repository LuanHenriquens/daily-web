import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchApproved,
  fetchDelivered,
  fetchIssues,
  jiraBaseUrl,
} from '@/lib/integrations/jiraApi';
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

describe('fetchDelivered', () => {
  // O nome do status final é livre por workflow — aqui é "Resolvido" e
  // "Fechado", em outra instância é "Done". Depender do nome quebraria fora
  // desta instância; a categoria e o histórico de transição, não.
  it('pergunta pelo que você encerrou hoje sem citar nome de status', async () => {
    const fetchMock = stubSearch([]);
    await fetchDelivered(CONN);

    const jql = jqlOf(fetchMock, 1);
    expect(jql).toContain('statusCategory = Done');
    expect(jql).toContain('status CHANGED BY currentUser() DURING (startOfDay(), now())');
    expect(jql).toContain('assignee = currentUser() AND resolved >= startOfDay()');
    expect(jql).not.toMatch(/Resolvido|Fechado|Done"/);
  });

  // Duas janelas numa passada: a lista é a dos sete dias, e a segunda busca
  // diz quais dessas caem em hoje. Assim trocar o período no painel não custa
  // uma ida ao Jira, e o corte do dia continua sendo o do Jira.
  it('pergunta pelas duas janelas, sete dias e hoje', async () => {
    const fetchMock = stubSearch([]);
    await fetchDelivered(CONN);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(jqlOf(fetchMock, 0)).toContain('startOfDay(-7d)');
    expect(jqlOf(fetchMock, 1)).toContain('DURING (startOfDay(), now())');
    expect(jqlOf(fetchMock, 1)).not.toContain('-7d');
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

    const [item] = await fetchDelivered(CONN);
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

describe('recorte por período', () => {
  // A lista devolvida é a dos sete dias; `today` é o que o painel usa para
  // mostrar só o dia sem voltar ao servidor.
  it('marca como de hoje só o que veio na janela do dia', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ issues: [issue('PDS-1'), issue('PDS-2')] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ issues: [issue('PDS-2')] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const items = await fetchDelivered(CONN);

    expect(items.map((i) => [i.key, i.today])).toEqual([
      ['PDS-1', false],
      ['PDS-2', true],
    ]);
  });
});

describe('fetchApproved', () => {
  // Não existe função JQL para "aprovadas por mim": `myApproved()` e
  // `approvedBy(currentUser())` são recusadas, e `approved()` sozinho traz o
  // que qualquer pessoa aprovou. O que restringe a você é a transição de
  // saída do status de aprovação ter sido sua.
  it('cruza a aprovação com a transição feita por você', async () => {
    const fetchMock = stubSearch([]);
    await fetchApproved(CONN);

    const jql = jqlOf(fetchMock);
    expect(jql).toContain('approvals = approved()');
    expect(jql).toContain('status CHANGED FROM "Aprovação" BY currentUser()');
  });

  it('pergunta pelas duas janelas, sete dias e hoje', async () => {
    const fetchMock = stubSearch([]);
    await fetchApproved(CONN);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(jqlOf(fetchMock, 0)).toContain('startOfDay(-7d)');
    expect(jqlOf(fetchMock, 1)).toContain('DURING (startOfDay(), now())');
  });

  it('traz a issue com o link de abrir', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ issues: [issue('PDS-2147')] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const [item] = await fetchApproved(CONN);
    expect(item.key).toBe('PDS-2147');
    expect(item.url).toBe('https://acme.atlassian.net/browse/PDS-2147');
    expect(item.today).toBe(true);
  });
});
