import React from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ConnectDialog: React.FC<Props> = ({ open, onClose }) => {
  const [host, setHost] = React.useState('');
  const [port, setPort] = React.useState(5432);
  const [database, setDatabase] = React.useState('');
  const [user, setUser] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await window.pgace.connect({ host, port, database, user, password });
        onClose();
      } catch (err) {
        console.error(err);
        alert('接続に失敗しました');
      }
    },
    [host, port, database, user, password, onClose]
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ background: '#fff', padding: '16px', width: '300px' }}
      >
        <div>
          <label>
            Host
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
        </div>
        <div>
          <label>
            Port
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>
        </div>
        <div>
          <label>
            Database
            <input
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
        </div>
        <div>
          <label>
            User
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
        </div>
        <div>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
        </div>
        <div style={{ marginTop: '8px', textAlign: 'right' }}>
          <button type="submit">接続</button>
        </div>
      </form>
    </div>
  );
};

export default ConnectDialog;
