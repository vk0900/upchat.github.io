import { User } from "@shared/schema";

interface UserSidebarProps {
  users: User[];
  onSelectUser: (user: User) => void;
}

export default function UserSidebar({ users, onSelectUser }: UserSidebarProps) {
  // Filter online and offline users
  const onlineUsers = users.filter(user => user.status !== "offline");
  const offlineUsers = users.filter(user => user.status === "offline");

  // Generate a color based on user id
  const getUserColor = (id: number) => {
    const colors = ["bg-red-500", "bg-green-500", "bg-blue-500", "bg-purple-500", "bg-yellow-500", "bg-discord-primary"];
    return colors[id % colors.length];
  };

  return (
    <aside className="hidden lg:block bg-discord-darker w-56 border-l border-gray-700 overflow-y-auto scrollbar-hide">
      <div className="p-3">
        <h2 className="text-discord-light text-xs uppercase font-semibold mb-2">
          Online — {onlineUsers.length}
        </h2>
        <ul className="space-y-1">
          {onlineUsers.map(user => (
            <li key={user.id} className="flex items-center py-1">
              <button 
                className="flex items-center w-full hover:bg-discord-dark rounded px-2 py-1"
                onClick={() => onSelectUser(user)}
              >
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full ${getUserColor(user.id)} flex items-center justify-center text-white`}>
                    <span>{user.username.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-discord-success rounded-full border-2 border-discord-darker"></div>
                </div>
                <span className="ml-2 text-white text-sm">{user.username}</span>
                {user.role === "admin" && (
                  <span className="ml-auto text-xs bg-discord-darkest py-0.5 px-1.5 rounded text-discord-light">
                    Admin
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
      
      {offlineUsers.length > 0 && (
        <div className="p-3">
          <h2 className="text-discord-light text-xs uppercase font-semibold mb-2">
            Offline — {offlineUsers.length}
          </h2>
          <ul className="space-y-1">
            {offlineUsers.map(user => (
              <li key={user.id} className="flex items-center py-1 opacity-60">
                <button 
                  className="flex items-center w-full hover:bg-discord-dark rounded px-2 py-1"
                  onClick={() => onSelectUser(user)}
                >
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-full ${getUserColor(user.id)} flex items-center justify-center text-white`}>
                      <span>{user.username.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 rounded-full border-2 border-discord-darker"></div>
                  </div>
                  <span className="ml-2 text-discord-light text-sm">{user.username}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
