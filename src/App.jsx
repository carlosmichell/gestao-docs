import React, { useState } from 'react';
import { FileText, Layers, ChevronDown, Menu } from 'lucide-react';
import ResultsPanel from './components/ResultsPanel';
import ToolPage from './components/ToolPage';
import StampPage from './components/StampPage';
import FgtsPage from './components/FgtsPage';
import ConvertPage from './components/ConvertPage';
import OrganizePage from './components/OrganizePage';
import TitleBar from './components/TitleBar';

const groups = [
  {
    id: 'rh',
    label: 'Documentos de RH',
    icon: FileText,
    items: [
      { id: 'trct', label: 'Termos de Rescisão' },
      { id: 'seguro', label: 'Apólices de Seguro' },
      { id: 'fgts', label: 'Extrato FGTS' },
    ],
  },
  {
    id: 'pdf',
    label: 'Ferramentas PDF',
    icon: Layers,
    items: [
      { id: 'carimbo', label: 'Carimbo em PDF' },
      { id: 'convert', label: 'DOC → PDF' },
      { id: 'organize', label: 'Organizar PDF' },
    ],
  },
];

const allItems = groups.flatMap(group => group.items);

function App() {
  const [page, setPage] = useState('trct');
  const [results, setResults] = useState(null);
  const [resultsModule, setResultsModule] = useState(null);
  const [openGroups, setOpenGroups] = useState({ rh: true, pdf: true });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activePage = page === 'results' ? resultsModule : page;
  const currentItem = allItems.find(item => item.id === activePage);
  const currentGroup = groups.find(group => group.items.some(item => item.id === activePage));
  const pageTitle = currentItem?.label ?? '';

  const toggleGroup = group => setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  const handleReset = () => {
    setPage(resultsModule ?? 'trct');
    setResults(null);
    setResultsModule(null);
  };
  const handleResults = (data, module) => {
    setResults(data);
    setResultsModule(module);
    setPage('results');
  };

  const renderMenuItem = item => {
    const isActive = activePage === item.id;
    return (
      <button
        key={item.id}
        type="button"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => setPage(item.id)}
        className={`sidebar-link ${isActive ? 'is-active' : ''}`}
      >
        {item.label}
      </button>
    );
  };

  const renderContent = () => {
    if (page === 'carimbo') return <StampPage />;
    if (page === 'fgts') return <FgtsPage onResults={data => handleResults(data, 'fgts')} />;
    if (page === 'convert') return <ConvertPage />;
    if (page === 'organize') return <OrganizePage />;
    if (page === 'trct' || page === 'seguro') {
      return <ToolPage module={page} onResults={data => handleResults(data, page)} />;
    }
    if (page === 'results' && results) {
      return (
        <div className="results-workspace workspace-scroll">
          <ResultsPanel results={results} onReset={handleReset} />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="enterprise-ui flex flex-col h-screen w-full overflow-hidden text-text">
      <TitleBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className={`app-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className="sidebar-brand" title="GestãoDocs">
            {sidebarCollapsed ? <span className="brand-initials">GD</span> : <><span className="brand-name">GESTÃO<span>DOCS</span></span><small>FERRAMENTAS PDF</small></>}
          </div>
          <nav className="sidebar-navigation custom-scrollbar" aria-label="Menu principal">
            {groups.map(group => {
              const GroupIcon = group.icon;
              return (
                <div className="sidebar-group" key={group.id}>
                  <button
                    type="button"
                    className={`sidebar-group-toggle ${currentGroup?.id === group.id ? 'is-current-group' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}
                    title={sidebarCollapsed ? group.label : undefined}
                    aria-label={sidebarCollapsed ? `Expandir ${group.label}` : undefined}
                    aria-expanded={!sidebarCollapsed && openGroups[group.id]}
                    onClick={() => sidebarCollapsed ? setSidebarCollapsed(false) : toggleGroup(group.id)}
                  >
                    <GroupIcon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {!sidebarCollapsed && <><span>{group.label}</span><ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${openGroups[group.id] ? '' : '-rotate-90'}`} /></>}
                  </button>
                  {!sidebarCollapsed && openGroups[group.id] && group.items.map(renderMenuItem)}
                </div>
              );
            })}
          </nav>
        </aside>
        <div className="app-main flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="app-toolbar">
            <button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setSidebarCollapsed(value => !value)}>
              <Menu className="w-4 h-4" />
            </button>
            <span>Gestão de documentos</span>
          </div>
          <div className="page-heading">
            <h1>{pageTitle}</h1>
            <nav className="breadcrumb" aria-label="Caminho da página">
              {page === 'results' ? (
                <>
                  <button type="button" onClick={handleReset}>{currentItem?.label}</button>
                  <span aria-hidden="true">/</span>
                  <strong aria-current="page">Resultado</strong>
                </>
              ) : (
                <>
                  <span>{currentGroup?.label}</span>
                  <span aria-hidden="true">/</span>
                  <strong aria-current="page">{pageTitle}</strong>
                </>
              )}
            </nav>
          </div>
          <main className="workspace-content flex-1 min-h-0 overflow-hidden no-drag">
            {renderContent()}
          </main>
          <footer className="app-footer"><strong>GestãoDocs</strong><span>Ferramentas para documentos de RH</span></footer>
        </div>
      </div>
    </div>
  );
}

export default App;
