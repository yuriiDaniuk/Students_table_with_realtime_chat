import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import LoginModal from "./LoginModal";
import { useSocketContext } from "./SocketContext";

function Header({ onLoginOpen }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { unreadMessages } = useSocketContext();

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse currentUser from localStorage:", error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setCurrentUser(null);
    window.location.reload();
  };

  const handleLoginClick = () => {
    setIsLoginModalOpen(true);
    if (onLoginOpen) onLoginOpen();
  };
  return (
    <header className="bg-[#909090] h-[60px] flex items-center justify-between px-5 text-white z-50 relative">
      <NavLink to="/">
        <span className="text-xl font-bold">CMS</span>
      </NavLink>

      <div className="flex items-center gap-6 h-full">
        <NavLink
          to="/messages"
          // Перенесли класи прямо сюди:
          className="relative group h-full flex items-center cursor-pointer"
        >
          <img
            src="https://cdn-icons-png.flaticon.com/512/3602/3602145.png"
            className="w-6 h-6 invert transition-transform duration-200 group-hover:scale-110"
            alt="Notifications"
          />

          {unreadMessages.length > 0 && (
            <span className="absolute top-[15px] right-[-2px] h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
          )}

          {unreadMessages.length > 0 && (
            <div className="hidden group-hover:block absolute top-[60px] right-0 w-[300px] bg-white shadow-lg border border-gray-200 rounded-lg z-50 p-4 max-h-[400px] overflow-y-auto">
              {unreadMessages.map((msg, index) => {
                const isLast = index === unreadMessages.length - 1;

                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 ${
                      isLast ? "" : "mb-3 pb-3 border-b border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center w-12 shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[#A8A5D8] text-white flex items-center justify-center text-xs font-bold">
                        {msg.sender.charAt(0)}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <strong className="text-xs text-black">
                        {msg.sender}
                      </strong>
                      <p className="text-sm text-gray-700 mt-1">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </NavLink>

        {/* Профіль */}
        <div className="relative group h-full flex items-center cursor-pointer">
          <div className="flex items-center gap-2">
            <img
              src="https://www.w3schools.com/howto/img_avatar.png"
              className="w-8 h-8 bg-white rounded-full p-0.5"
              alt="Profile"
            />
            <span>
              {currentUser
                ? currentUser.firstname && currentUser.lastname
                  ? `${currentUser.firstname} ${currentUser.lastname}`
                  : currentUser.name
                : "Guest"}
            </span>
          </div>
          <div className="hidden group-hover:block absolute top-[60px] right-0 min-w-[150px] bg-white shadow-lg border border-gray-200 z-50 py-1">
            {currentUser ? (
              <>
                <a
                  href="#"
                  className="block px-5 py-3 text-sm text-black hover:bg-gray-100"
                >
                  Profile
                </a>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-5 py-3 text-sm text-red-600 hover:bg-gray-100 border-none bg-transparent cursor-pointer"
                >
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={handleLoginClick}
                className="block w-full text-left px-5 py-3 text-sm text-black hover:bg-gray-100 border-none bg-transparent cursor-pointer"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </header>
  );
}

export default Header;
