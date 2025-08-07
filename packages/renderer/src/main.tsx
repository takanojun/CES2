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
      setStatus(`${r.length} rows`);
      await loadHistory();
    } catch (e: any) {
      setStatus(e.message);
      setRows([]);
    }
  };

  const renderResultTable = () => {
    if (rows.length === 0) return null;
    const columns = Object.keys(rows[0]);
    return (
      <table border={1} cellPadding={4} style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((c) => (
                <td key={c}>{String(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
