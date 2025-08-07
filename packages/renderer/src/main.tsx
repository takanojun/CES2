import React from 'react';
import ReactDOM from 'react-dom/client';
import ConnectDialog from './ConnectDialog';

interface SqlFile {
  name: string;
  content: string;
}

interface SqlFolder {
  dir: string;
  files: SqlFile[];
}

interface ResultContextValue {
  rows: any[];
  setRows: React.Dispatch<React.SetStateAction<any[]>>;
}

const ResultContext = React.createContext<ResultContextValue | null>(null);

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
  const [dir, setDir] = React.useState('');
  const [files, setFiles] = React.useState<SqlFile[]>([]);

  const handleBrowse = React.useCallback(async () => {
    const res: SqlFolder = await window.pgace.openSqlFolder();
    setDir(res.dir);
    setFiles(res.files);
  }, []);

  const handleLoad = React.useCallback(async () => {
    if (!dir) return;
    const res: SqlFolder = await window.pgace.openSqlFolder(dir);
    setDir(res.dir);
    setFiles(res.files);
  }, [dir]);

  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '8px' }}>
        <input
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          style={{ width: '60%' }}
        />
        <button onClick={handleBrowse}>参照</button>
        <button onClick={handleLoad}>読み込み</button>
      </div>
      <ul style={{ overflow: 'auto', flex: 1 }}>
        {files.map((f) => (
          <li key={f.name}>{f.name}</li>
        ))}
      </ul>
    </div>
  );
};

const SqlEditor: React.FC = () => {
  const ctx = React.useContext(ResultContext);
  if (!ctx) return null;
  const { setRows } = ctx;
  const [sql, setSql] = React.useState('');

  const runQuery = React.useCallback(async () => {
    try {
      const rows = await window.pgace.query({ sql });
      setRows(rows);
    } catch (e: any) {
      setRows([{ error: String(e) }]);
    }
  }, [sql, setRows]);

  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        style={{ flex: 1, width: '100%' }}
      />
      <button onClick={runQuery}>実行</button>
    </div>
  );
};

const ResultGrid: React.FC = () => {
  const ctx = React.useContext(ResultContext);
  if (!ctx) return null;
  const { rows } = ctx;

  if (rows.length === 0) {
    return <div style={{ padding: '8px' }}>結果なし</div>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div style={{ overflow: 'auto', padding: '8px', height: '100%' }}>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} style={{ border: '1px solid #ccc', padding: '4px' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} style={{ border: '1px solid #ccc', padding: '4px' }}>
                  {String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PropertyPanel: React.FC = () => (
  <div style={{ padding: '8px' }}>プロパティ（未実装）</div>
);

const PanelWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children
}) => (
  <div
    style={{
      flex: 1,
      border: '1px solid #ccc',
      margin: '4px',
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    <div style={{ background: '#eee', padding: '4px' }}>{title}</div>
    <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
  </div>
);

const App: React.FC = () => {
  const [rows, setRows] = React.useState<any[]>([]);
  const [connectOpen, setConnectOpen] = React.useState(true);

  React.useEffect(() => {
    const dispose = window.pgace.onOpenConnect(() => setConnectOpen(true));
    return () => {
      dispose && dispose();
    };
  }, []);

  return (
    <ResultContext.Provider value={{ rows, setRows }}>
      <div style={{ display: 'flex', height: '100vh' }}>
        <div style={{ flexBasis: '20%', display: 'flex', flexDirection: 'column' }}>
          <PanelWrapper title="DBエクスプローラ">
            <DbExplorer />
          </PanelWrapper>
        </div>
        <div style={{ flex: 1, display: 'flex' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <PanelWrapper title="SQLエディタ">
              <SqlEditor />
            </PanelWrapper>
            <PanelWrapper title="結果">
              <ResultGrid />
            </PanelWrapper>
          </div>
          <div style={{ flexBasis: '25%', display: 'flex', flexDirection: 'column' }}>
            <PanelWrapper title="SQLエクスプローラ">
              <SqlExplorer />
            </PanelWrapper>
            <PanelWrapper title="プロパティ">
              <PropertyPanel />
            </PanelWrapper>
          </div>
        </div>
      </div>
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </ResultContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);

