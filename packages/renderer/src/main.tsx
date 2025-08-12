import React from 'react';
import ReactDOM from 'react-dom/client';
import ConnectDialog from './ConnectDialog';

window.addEventListener('error', (e) => {
  window.pgace.logError(
    e.error instanceof Error ? e.error.stack ?? e.error.message : e.message
  );
});

window.addEventListener('unhandledrejection', (e) => {
  window.pgace.logError(
    e.reason instanceof Error
      ? e.reason.stack ?? e.reason.message
      : String(e.reason)
  );
});

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

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    window.pgace.logError(error?.stack ?? String(error));
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '8px' }}>予期しないエラーが発生しました</div>;
    }
    return this.props.children;
  }
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
    <div
      style={{
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      <button onClick={loadTables} style={{ marginBottom: '8px' }}>
        更新
      </button>
      <ul style={{ overflow: 'auto', flex: 1, margin: 0, paddingLeft: '16px' }}>
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
  const [sql, setSql] = React.useState('');
  if (!ctx) return null;
  const { setRows } = ctx;

  const runQuery = React.useCallback(async () => {
    try {
      const res = await window.pgace.query({ sql });
      if (!Array.isArray(res)) throw new Error('invalid response');
      setRows(res);
    } catch (e: any) {
      console.error(e);
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
  const rows = ctx?.rows ?? [];
  const [selectedRows, setSelectedRows] = React.useState<Set<number>>(new Set());
  const [selectedCols, setSelectedCols] = React.useState<Set<string>>(new Set());
  const [lastRow, setLastRow] = React.useState<number | null>(null);
  const [lastCol, setLastCol] = React.useState<string | null>(null);
  const [colWidths, setColWidths] = React.useState<Record<string, number>>({});
  const rowDragStart = React.useRef<number | null>(null);
  const colDragStart = React.useRef<number | null>(null);
  const rowDragMoved = React.useRef(false);
  const colDragMoved = React.useRef(false);

  const startResize = React.useCallback(
    (col: string, e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = colWidths[col] ?? 120;
      const onMouseMove = (ev: MouseEvent) => {
        setColWidths((w) => ({
          ...w,
          [col]: Math.max(50, startWidth + ev.clientX - startX)
        }));
      };
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [colWidths]
  );

  const cols = React.useMemo(
    () => (rows.length > 0 ? Object.keys(rows[0]) : []),
    [rows]
  );

  const startRowDrag = React.useCallback(
    (i: number, e: React.MouseEvent<HTMLTableRowElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      rowDragStart.current = i;
      rowDragMoved.current = false;
      setSelectedRows(new Set([i]));
      setLastRow(i);
      const onMouseUp = () => {
        rowDragStart.current = null;
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mouseup', onMouseUp);
    },
    []
  );

  const handleRowEnter = React.useCallback(
    (i: number) => {
      if (rowDragStart.current === null) return;
      rowDragMoved.current = true;
      const start = rowDragStart.current;
      const [s, e] = [Math.min(start, i), Math.max(start, i)];
      const next = new Set<number>();
      for (let idx = s; idx <= e; idx++) next.add(idx);
      setSelectedRows(next);
    },
    [setSelectedRows]
  );

  const startColDrag = React.useCallback(
    (c: string, i: number, e: React.MouseEvent<HTMLTableHeaderCellElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      colDragStart.current = i;
      colDragMoved.current = false;
      setSelectedCols(new Set([c]));
      setLastCol(c);
      const onMouseUp = () => {
        colDragStart.current = null;
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mouseup', onMouseUp);
    },
    []
  );

  const handleColEnter = React.useCallback(
    (i: number) => {
      if (colDragStart.current === null) return;
      colDragMoved.current = true;
      const start = colDragStart.current;
      const [s, e] = [Math.min(start, i), Math.max(start, i)];
      const next = new Set<string>();
      for (let idx = s; idx <= e; idx++) next.add(cols[idx]);
      setSelectedCols(next);
    },
    [cols, setSelectedCols]
  );

  const handleRowClick = React.useCallback(
    (i: number, e: React.MouseEvent<HTMLTableRowElement>) => {
      if (rowDragMoved.current) {
        rowDragMoved.current = false;
        return;
      }
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastRow !== null) {
          next.clear();
          const [start, end] = [Math.min(lastRow, i), Math.max(lastRow, i)];
          for (let idx = start; idx <= end; idx++) next.add(idx);
        } else if (e.ctrlKey || e.metaKey) {
          next.has(i) ? next.delete(i) : next.add(i);
          setLastRow(i);
        } else {
          next.clear();
          next.add(i);
          setLastRow(i);
        }
        return next;
      });
    },
    [lastRow]
  );

  const handleColClick = React.useCallback(
    (c: string, i: number, e: React.MouseEvent<HTMLTableHeaderCellElement>) => {
      if (colDragMoved.current) {
        colDragMoved.current = false;
        return;
      }
      setSelectedCols((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastCol !== null) {
          next.clear();
          const startIndex = cols.indexOf(lastCol);
          const [start, end] = [Math.min(startIndex, i), Math.max(startIndex, i)];
          for (let idx = start; idx <= end; idx++) next.add(cols[idx]);
        } else if (e.ctrlKey || e.metaKey) {
          next.has(c) ? next.delete(c) : next.add(c);
          setLastCol(c);
        } else {
          next.clear();
          next.add(c);
          setLastCol(c);
        }
        return next;
      });
    },
    [lastCol, cols]
  );

  if (!ctx) return null;
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div style={{ padding: '8px' }}>結果なし</div>;
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        overflowY: 'auto',
        padding: '8px',
        height: '100%'
      }}
    >
      <table style={{ borderCollapse: 'collapse', width: 'max-content' }}>
        <thead>
          <tr>
            {cols.map((c, idx) => (
              <th
                key={c}
                onClick={(e) => handleColClick(c, idx, e)}
                onMouseDown={(e) => startColDrag(c, idx, e)}
                onMouseEnter={() => handleColEnter(idx)}
                style={{
                  border: '1px solid #ccc',
                  padding: '4px',
                  position: 'relative',
                  width: colWidths[c] ?? 120,
                  background: selectedCols.has(c) ? '#d0e7ff' : undefined,
                  userSelect: 'none'
                }}
              >
                {c}
                <div
                  onMouseDown={(e) => startResize(c, e)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '5px',
                    height: '100%',
                    cursor: 'col-resize'
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={(e) => handleRowClick(i, e)}
              onMouseDown={(e) => startRowDrag(i, e)}
              onMouseEnter={() => handleRowEnter(i)}
            >
              {cols.map((c) => (
                <td
                  key={c}
                  style={{
                    border: '1px solid #ccc',
                    padding: '4px',
                    width: colWidths[c] ?? 120,
                    background:
                      selectedRows.has(i) || selectedCols.has(c)
                        ? '#d0e7ff'
                        : undefined
                  }}
                >
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
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
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
      <div style={{ display: 'flex', height: '100vh', gap: '4px', overflow: 'hidden' }}>
        <div style={{ flexBasis: '20%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <PanelWrapper title="DBエクスプローラ">
            <DbExplorer />
          </PanelWrapper>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '4px', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <PanelWrapper title="SQLエディタ">
              <SqlEditor />
            </PanelWrapper>
            <PanelWrapper title="結果">
              <ResultGrid />
            </PanelWrapper>
          </div>
          <div style={{ flexBasis: '25%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

