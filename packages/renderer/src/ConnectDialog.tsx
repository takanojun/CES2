import React from 'react';

interface DbConnectParams {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

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
  const [profiles, setProfiles] = React.useState<DbConnectParams[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    void window.pgace
      .profileList()
      .then((list) => setProfiles(list))
      .catch(() => setProfiles([]));
  }, [open]);

  const applyProfile = React.useCallback((p: DbConnectParams) => {
    setHost(p.host);
    setPort(p.port);
    setDatabase(p.database);
    setUser(p.user);
    setPassword(p.password);
  }, []);

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
        {profiles.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <button type="button" onClick={() => setShowHistory(true)}>
              履歴
            </button>
          </div>
        )}
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

      {showHistory && (
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
            zIndex: 1100
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '16px',
              width: '300px',
              maxHeight: '80%',
              overflow: 'auto'
            }}
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {profiles.map((p, i) => (
                <li key={i} style={{ marginBottom: '8px' }}>
                  <button
                    type="button"
                    style={{ width: '100%' }}
                    onClick={() => {
                      applyProfile(p);
                      setShowHistory(false);
                    }}
                  >{`${p.host}:${p.port}/${p.database} (${p.user})`}</button>
                </li>
              ))}
            </ul>
            <div style={{ textAlign: 'right', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowHistory(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectDialog;
