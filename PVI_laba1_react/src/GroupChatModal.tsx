import { useState, useEffect } from "react";
import { useSocketContext } from "./SocketContext";

interface Contact {
  id: number;
  firstname: string;
  lastname: string;
}

interface GroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onGroupCreated: (newChat: any) => void;
}

export default function GroupChatModal({
  isOpen,
  onClose,
  contacts,
  onGroupCreated,
}: GroupChatModalProps) {
  const { socket } = useSocketContext();
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Get current user from localStorage
  const storedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const currentUserId = storedUser.id ? String(storedUser.id) : null;

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(
    (contact) =>
      `${contact.firstname} ${contact.lastname}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  // Handle user selection/deselection
  const toggleUserSelection = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Remove selected user (from badge)
  const removeSelectedUser = (userId: number) => {
    setSelectedUsers((prev) => prev.filter((id) => id !== userId));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!groupName.trim()) {
      setError("Please enter a group name");
      return;
    }

    if (selectedUsers.length < 2) {
      setError("Please select at least 2 users");
      return;
    }

    setIsLoading(true);

    try {
      // Prepare request payload
      const payload = {
        chatName: groupName,
        userId: currentUserId,
        users: selectedUsers.map((id) => String(id)), // Convert to strings to match user IDs
      };

      // Create group chat via API
      const response = await fetch("http://localhost:3001/api/chats/create-group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create group");
      }

      const newChat = await response.json();

      // Emit socket event to notify all users about the new group
      socket.emit("new_group_created", {
        _id: newChat._id,
        groupName: newChat.chatName,
        createdBy: storedUser.firstname + " " + storedUser.lastname,
        users: newChat.users.map((u: any) => (typeof u === "string" ? u : u._id)), // Map user objects to IDs
        updatedAt: newChat.updatedAt,
      });

      // Update the chat list with the new group
      onGroupCreated({
        id: newChat._id,
        firstname: newChat.chatName,
        lastname: "(Group)",
        isGroup: true,
        isGroupChat: true,
        _id: newChat._id,
        chatName: newChat.chatName,
      });

      // Reset form and close modal
      setGroupName("");
      setSelectedUsers([]);
      setSearchQuery("");
      onClose();
    } catch (err) {
      console.error("Error creating group:", err);
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[500px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Create Group Chat</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Group Name Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A8A5D8] focus:border-transparent"
            />
          </div>

          {/* Selected Users Badges */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Selected Users ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {selectedUsers.map((userId) => {
                  const contact = contacts.find((c) => c.id === userId);
                  return (
                    <span
                      key={userId}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-[#A8A5D8] text-white rounded-full text-sm"
                    >
                      {contact?.firstname} {contact?.lastname}
                      <button
                        type="button"
                        onClick={() => removeSelectedUser(userId)}
                        className="ml-1 hover:bg-opacity-80"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Add Users
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A8A5D8] focus:border-transparent"
            />
          </div>

          {/* User List */}
          <div className="border border-gray-200 rounded-lg max-h-[300px] overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">
                No users found
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredContacts.map((contact) => (
                  <li key={contact.id} className="px-4 py-3">
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 -mx-4 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(contact.id)}
                        onChange={() => toggleUserSelection(contact.id)}
                        className="w-4 h-4 accent-[#A8A5D8] rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {contact.firstname} {contact.lastname}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#A8A5D8] text-white rounded-lg hover:bg-opacity-90 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
