import React from 'react';
import ReactDOM from 'react-dom/client';

interface SqlFile {
  name: string;
  content: string;
}

const DbExplorer: React.FC = () => {
  const [tables, setTables] = React.useState<string[]>([]);

  const loadTables = React.useCallback(async () => {
    try {
      const list = await window.pgace.listTables('public');
      setTables(list);
    } catch {
      setTables([]);
    }
  }, []);

  React.useEffect(() => {
    void loadTables();
  }, [loadTables]);

  return (
    <div style={{ padding: '8px' }}>
      <button onClick={loadTables}>更新</button>
      <ul>
        {tables.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
};

const SqlExplorer: React.FC = () => {
  const [files, setFiles] = React.useState<SqlFile[]>([]);

  const handleOpenFolder = React.useCallback(async () => {
    const list = await window.pgace.openSqlFolder();
    setFiles(list);
  }, []);

  return (
    <div style={{ padding: '8px' }}>
      <button onClick={handleOpenFolder}>フォルダを開く</button>
      <ul>
        {files.map((f) => (
          <li key={f.name}>{f.name}</li>
        ))}
      </ul>
    </div>
  );
};

type Panel = 'db' | 'sql';

const App: React.FC = () => {
  const [panels, setPanels] = React.useState<Panel[]>(['db', 'sql']);
  const [dragPanel, setDragPanel] = React.useState<Panel | null>(null);

  const handleDragStart = (p: Panel) => () => {
    setDragPanel(p);
  };

  const handleDrop = (p: Panel) => () => {
    if (dragPanel === null || dragPanel === p) return;
    setPanels((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragPanel);
      const to = next.indexOf(p);
      next.splice(from, 1);
      next.splice(to, 0, dragPanel);
      return next;
    });
    setDragPanel(null);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const renderPanel = (p: Panel) => {
    const title = p === 'db' ? 'DBエクスプローラ' : 'SQLエクスプローラ';
    const content = p === 'db' ? <DbExplorer /> : <SqlExplorer />;
    return (
      <div
        key={p}
        draggable
        onDragStart={handleDragStart(p)}
        onDragOver={handleDragOver}
        onDrop={handleDrop(p)}
        style={{
          flex: 1,
          border: '1px solid #ccc',
          margin: '4px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ background: '#eee', padding: '4px', cursor: 'move' }}>
          {title}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{content}</div>
      </div>
    );
  };

  return <div style={{ display: 'flex', height: '100vh' }}>{panels.map(renderPanel)}</div>;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);

