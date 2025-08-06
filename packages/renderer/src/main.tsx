import React from 'react';
import ReactDOM from 'react-dom/client';

const App: React.FC = () => {
  const [result, setResult] = React.useState('Ready');

  const handleTest = async () => {
    try {
      await window.pgace.connect({
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: ''
      });
      const rows = await window.pgace.query({ sql: 'SELECT 1' });
      setResult(JSON.stringify(rows));
    } catch (e: any) {
      setResult(e.message);
    }
  };

  const handleHistory = async () => {
    try {
      const history = await window.pgace.historyList();
      setResult(JSON.stringify(history, null, 2));
    } catch (e: any) {
      setResult(e.message);
    }
  };

  return (
    <div>
      <h1>PgAce</h1>
      <button onClick={handleTest}>Test Query</button>
      <button onClick={handleHistory}>Show History</button>
      <pre>{result}</pre>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
