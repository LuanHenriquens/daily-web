'use client';

import { Fragment, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { focusRing, isActivePath, type Density, type ThemePreference } from '@/lib/theme';
import { AccountMenu } from './AccountMenu';
import { CommandPalette } from './CommandPalette';
import { NAV_ITEMS, groupStart } from './nav-items';

interface Props {
  theme: ThemePreference;
  density: Density;
  username: string | null;
  children: ReactNode;
}

/**
 * The page never scrolls: h-dvh plus overflow-hidden pins the frame to the
 * viewport so the fixed mesh stays still and only the content moves. Nothing here
 * is sticky or fixed — persistence is structural, because the sidebar and the
 * mobile header are flex siblings outside the single scroll container.
 */
export function AppShell({ theme, density, username, children }: Props) {
  const pathname = usePathname() ?? '/';
  const [paletteOpen, setPaletteOpen] = useState(false);

  const active = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));
  const account = (
    <AccountMenu initialTheme={theme} initialDensity={density} username={username} />
  );

  return (
    <div className="flex h-dvh gap-3 overflow-hidden p-3">
      <aside className="hidden w-60 shrink-0 flex-col overflow-hidden rounded-2xl border bg-glass shadow-e3 backdrop-blur-xl backdrop-saturate-150 md:flex">
        <div className="flex shrink-0 items-center gap-3 px-5 pt-5 pb-4">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-glass-strong shadow-e1">
            <span className="size-2 rounded-full bg-brand" aria-hidden />
          </span>
          <span className="truncate text-[0.975rem] font-semibold tracking-tight">daily-web</span>
        </div>

        <div className="shrink-0 px-3 pb-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className={cn(
              'flex w-full items-center gap-2 rounded-full border bg-glass-strong py-2 pr-2 pl-3.5 text-sm text-ink-dim shadow-e1 transition-colors duration-100 ease-brand hover:text-ink-mid motion-reduce:transition-none',
              focusRing,
            )}
          >
            <Search className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Buscar</span>
            {/* border-line, not the bare border: a bare border gives the white glass
                seal, and this one wants the real gray hairline. */}
            <kbd className="type-caption shrink-0 rounded-full border border-line px-1.5 py-0.5 text-ink-dim">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* min-h-0 is load-bearing: without it the flex child takes content height
            and the whole page scrolls again, which unpins the background. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {/* No horizontal padding here, so the active band bleeds to the panel
              edge. The padding lives on each item. */}
          <nav className="flex flex-col py-3">
            {NAV_ITEMS.map((item, i) => {
              const isActive = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Fragment key={item.href}>
                  {groupStart(NAV_ITEMS, i) && (
                    <span className="type-caption px-5 pt-5 pb-1 text-ink-dim first:pt-1">
                      {item.group}
                    </span>
                  )}
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-3 py-2.5 pr-3 pl-5 text-sm transition-colors duration-100 ease-brand motion-reduce:transition-none',
                      focusRing,
                      isActive
                        ? [
                            'bg-[linear-gradient(to_right,var(--brand-tint),transparent_68%)] text-ink',
                            "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand before:content-['']",
                            'dark:before:shadow-[0_0_8px_0_var(--brand)]',
                          ]
                        : 'text-ink-mid hover:bg-glass-line hover:text-ink',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {item.label}
                  </Link>
                </Fragment>
              );
            })}
          </nav>
        </div>

        {/* The only internal border in the sidebar. */}
        <div className="flex shrink-0 flex-col gap-1 border-t p-2.5">{account}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        {/* Below md the sidebar is hidden, so this is the only navigation on a
            phone and cannot be left empty. */}
        <header className="flex h-14 shrink-0 items-center gap-2 rounded-2xl border bg-glass px-3 shadow-e2 backdrop-blur-xl md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir navegação">
                <Menu className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
              {NAV_ITEMS.map((item, i) => (
                <Fragment key={item.href}>
                  {groupStart(NAV_ITEMS, i) && <DropdownMenuLabel>{item.group}</DropdownMenuLabel>}
                  <DropdownMenuItem asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="truncate font-semibold tracking-tight">
            {active?.label ?? 'daily-web'}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buscar"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-4" />
            </Button>
            <div className="w-40">{account}</div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-2 pt-6 pb-10 md:px-4">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
