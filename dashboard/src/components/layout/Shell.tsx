import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar, type Page } from './Sidebar';
import './Shell.css';

interface ShellProps {
  children: (page: Page) => ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [activePage, setActivePage] = useState<Page>('tasks');

  return (
    <div className="shell">
      <Header />
      <div className="shell-body">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="shell-main">
          {children(activePage)}
        </main>
      </div>
    </div>
  );
}
