import React from 'react';
import ReactDOM from 'react-dom/client';

interface HistoryEntry {
  timestamp: string;
  sql: string;
}

const App: React.FC = () => {
  const [host, setHost] = React.useState('localhost');
  const [port, setPort] = React.useState('5432');
  const [database, setDatabase] = React.useState('postgres');
  const [user, setUser] = React.useState('postgres');
  const [password, setPassword] = React.useState('');
  const [sql, setSql] = React.useState('SELECT 1');
  const [status, setStatus] = React.useState('Ready');
  const [rows, setRows] = React.useState<any[]>([]);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [selectedRow, setSelectedRow] = React.useState<number | null>(null);
  const [selectedCol, setSelectedCol] = React.useState<string | null>(null);
  const [colWidths, setColWidths] = React.useState<Record<string, number>>({});

  const loadHistory = React.useCallback(async () => {
    const list = await window.pgace.historyList();
    setHistory(list);
  }, []);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleConnect = async () => {
    try {
      await window.pgace.connect({
        host,
        port: Number(port),
        database,
        user,
        password
      });
      setStatus('Connected');
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  const handleQuery = async () => {
    try {
      const r = await window.pgace.query({ sql });
      setRows(r);
      const cols = Object.keys(r[0] ?? {});
      setColWidths((prev) => {
        const next: Record<string, number> = { ...prev };
        cols.forEach((c) => {
          if (!(c in next)) next[c] = 150;
        });
        return next;
      });
      setSelectedRow(null);
      setSelectedCol(null);
      setStatus(`${r.length} rows`);
      await loadHistory();
    } catch (e: any) {
      setStatus(e.message);
      setRows([]);
      setSelectedRow(null);
      setSelectedCol(null);
    }
  };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    column: string
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[column] ?? 150;
    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX;
      setColWidths((prev) => ({
        ...prev,
        [column]: Math.max(30, startWidth + diff)
      }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const renderResultTable = () => {
    if (rows.length === 0) return null;
    const columns = Object.keys(rows[0]);
    return (
      <div style={{ marginTop: '1rem', overflow: 'auto' }}>
        <table
          style={{ borderCollapse: 'collapse', userSelect: 'none' }}
        >
          <colgroup>
            <col style={{ width: 40 }} />
            {columns.map((c) => (
              <col key={c} style={{ width: colWidths[c] ?? 150 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', background: '#eee' }} />
              {columns.map((c) => (
                <th
                  key={c}
                  style={{
                    position: 'relative',
                    border: '1px solid #ccc',
                    background: '#eee'
                  }}
                  onClick={() => {
                    setSelectedRow(null);
                    setSelectedCol(c);
                  }}
                >
                  {c}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 4,
                      height: '100%',
                      cursor: 'col-resize'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, c)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <th
                  style={{
                    border: '1px solid #ccc',
                    background: '#eee',
                    textAlign: 'right',
                    padding: '0 4px',
                    backgroundColor: selectedRow === idx ? '#b3d7ff' : '#eee'
                  }}
                  onClick={() => {
                    setSelectedCol(null);
                    setSelectedRow(idx);
                  }}
                >
                  {idx + 1}
                </th>
                {columns.map((c) => (
                  <td
                    key={c}
                    style={{
                      border: '1px solid #ccc',
                      padding: '0 4px',
                      backgroundColor:
                        selectedRow === idx || selectedCol === c
                          ? '#d7ebff'
                          : 'transparent'
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

  const renderHistoryTable = () => {
    if (history.length === 0) return null;
    return (
      <div style={{ marginTop: '1rem' }}>
        <h2>履歴</h2>
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>時刻</th>
              <th>SQL</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, idx) => (
              <tr key={idx}>
                <td>{h.timestamp}</td>
                <td>{h.sql}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <h1>PgAce</h1>
      <div>
        <input
          placeholder="host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <input
          placeholder="port"
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
        />
        <input
          placeholder="database"
          value={database}
          onChange={(e) => setDatabase(e.target.value)}
        />
        <input
          placeholder="user"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleConnect}>Connect</button>
      </div>
      <div>
        <textarea
          rows={4}
          cols={40}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
        />
        <button onClick={handleQuery}>Run Query</button>
      </div>
      <div style={{ marginTop: '1rem' }}>{status}</div>
      {renderResultTable()}
      {renderHistoryTable()}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
