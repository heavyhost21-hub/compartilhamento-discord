import './UserList.css';

function Avatar({ name, isHost, isSharing }) {
  const initial = (name?.[0] ?? '?').toUpperCase();
  return (
    <div className={`user-avatar ${isHost ? 'host' : ''} ${isSharing ? 'sharing' : ''}`}>
      {initial}
      {isSharing && <span className="sharing-dot" />}
    </div>
  );
}

export default function UserList({ users, myId, maxViewers, viewerCount }) {
  return (
    <aside className="user-list">
      <div className="user-list-header">
        <span>Participantes — {users.length}</span>
        <span className="viewer-limit">{viewerCount}/{maxViewers}</span>
      </div>

      <div className="user-list-section">
        <h3>Host</h3>
        {users.filter((u) => u.isHost).map((user) => (
          <div key={user.id} className={`user-item ${user.id === myId ? 'me' : ''}`}>
            <Avatar name={user.name} isHost isSharing={user.sharing} />
            <div className="user-info">
              <span className="user-name">{user.name}{user.id === myId ? ' (você)' : ''}</span>
              <span className="user-status">{user.sharing ? 'Compartilhando tela' : 'Online'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="user-list-section">
        <h3>Espectadores — {users.filter((u) => !u.isHost).length}</h3>
        {users.filter((u) => !u.isHost).length === 0 && (
          <p className="empty-viewers">Nenhum espectador conectado</p>
        )}
        {users.filter((u) => !u.isHost).map((user) => (
          <div key={user.id} className={`user-item ${user.id === myId ? 'me' : ''}`}>
            <Avatar name={user.name} isSharing={user.sharing} />
            <div className="user-info">
              <span className="user-name">{user.name}{user.id === myId ? ' (você)' : ''}</span>
              <span className="user-status">{user.sharing ? 'Compartilhando tela' : 'Assistindo'}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
