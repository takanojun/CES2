import React from 'react';
import ReactDOM from 'react-dom/client';

const App: React.FC = () => {
  const [host, setHost] = React.useState('localhost');
  const [port, setPort] = React.useState('5432');
  const [database, setDatabase] = React.useState('postgres');
  const [user, setUser] = React.useState('postgres');
  const [password, setPassword] = React.useState('');
  const [sql, setSql] = React.useState('SELECT 1');
  const [result, setResult] = React.useState('Ready');

  const handleConnect = async () => {
    try {
      await window.pgace.connect({
        host,
        port: Number(port),
        database,
        user,
        password
      });
      setResult('Connected');
    } catch (e: any) {
      setResult(e.message);
    }
  };

  const handleQuery = async () => {
    try {
      const rows = await window.pgace.query({ sql });
      setResult(JSON.stringify(rows, null, 2));
    } catch (e: any) {
      setResult(e.message);
    }
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
      <pre>{result}</pre>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
