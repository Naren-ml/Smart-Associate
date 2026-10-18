import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  CheckCheck,
  ShieldCheck,
  Circle,
  Building2,
  Clock,
  UserCheck
} from "lucide-react";

function TeamChat() {
  const [selectedUser, setSelectedUser] = useState("Priya");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef(null);

  const [users, setUsers] = useState([
    {
      name: "Priya",
      role: "Senior Audit Lead",
      initials: "PS",
      online: true,
      lastMessage: "The GST reconciliation documents are ready for sign-off.",
      time: "10:42 AM",
      unread: 2,
    },
    {
      name: "Arun",
      role: "Tax Associate",
      initials: "AR",
      online: true,
      lastMessage: "I'll cross-check the client Form 26AS right away.",
      time: "10:15 AM",
      unread: 0,
    },
    {
      name: "Karthik",
      role: "Statutory Audit Associate",
      initials: "KA",
      online: false,
      lastMessage: "Thanks, the voucher audit notes are uploaded.",
      time: "Yesterday",
      unread: 0,
    },
    {
      name: "Divya",
      role: "Direct Tax Specialist",
      initials: "DV",
      online: false,
      lastMessage: "Can you send the Advance Tax computation report?",
      time: "Yesterday",
      unread: 0,
    },
  ]);

  const selected = users.find((user) => user.name === selectedUser) || users[0];

  const [conversations, setConversations] = useState({
    Priya: [
      {
        sender: "Priya",
        text: "Hi Narendhiran, have you verified the GST return input tax credit for ABC Enterprises?",
        time: "10:36 AM",
        own: false,
      },
      {
        sender: "You",
        text: "Yes, currently matching GSTR-2B with the purchase register. I'll finish within an hour.",
        time: "10:39 AM",
        own: true,
      },
      {
        sender: "Priya",
        text: "The GST reconciliation documents are ready for sign-off.",
        time: "10:42 AM",
        own: false,
      },
    ],
    Arun: [
      {
        sender: "Arun",
        text: "Hey! Did you receive the TDS statements for Raj & Co.?",
        time: "10:10 AM",
        own: false,
      },
      {
        sender: "You",
        text: "Yes, verified them. Form 26AS looks clean.",
        time: "10:12 AM",
        own: true,
      },
      {
        sender: "Arun",
        text: "I'll cross-check the client Form 26AS right away.",
        time: "10:15 AM",
        own: false,
      },
    ],
    Karthik: [
      {
        sender: "You",
        text: "Karthik, can you check the physical asset register for Green Solutions?",
        time: "Yesterday",
        own: true,
      },
      {
        sender: "Karthik",
        text: "Thanks, the voucher audit notes are uploaded.",
        time: "Yesterday",
        own: false,
      },
    ],
    Divya: [
      {
        sender: "Divya",
        text: "Can you send the Advance Tax computation report?",
        time: "Yesterday",
        own: false,
      },
    ],
  });

  const activeMessages = conversations[selectedUser] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedUser, conversations]);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    const newMsg = {
      sender: "You",
      text: message.trim(),
      time: "Just now",
      own: true,
    };

    setConversations((prev) => ({
      ...prev,
      [selectedUser]: [...(prev[selectedUser] || []), newMsg],
    }));

    // Update last message in roster
    setUsers((prev) =>
      prev.map((u) =>
        u.name === selectedUser
          ? { ...u, lastMessage: message.trim(), time: "Just now" }
          : u
      )
    );

    setMessage("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="team-chat-page">
      <div className="module-header">
        <div className="module-title">
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--primary-blue)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>
            <MessageSquare size={13} />
            <span>CONFIDENTIAL INTERNAL MESSENGER</span>
          </div>
          <h1>Team Chat &amp; Engagement Comms</h1>
          <p>End-to-end encrypted discussion for audit teams, tax queries, and partner directives.</p>
        </div>

        <div className="nav-portal-badge" style={{ alignSelf: "flex-start" }}>
          <ShieldCheck size={14} color="var(--success)" />
          <span>In-House Confidentiality Protected</span>
        </div>
      </div>

      <div className="chat-app-card">
        {/* LEFT ROSTER SIDEBAR */}
        <aside className="chat-roster-sidebar">
          <div className="chat-roster-header">
            <div className="input-with-icon">
              <Search size={15} className="input-icon-left" />
              <input
                type="text"
                placeholder="Search associates or audit leads..."
                className="chat-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="chat-roster-list">
            {filteredUsers.map((user) => (
              <button
                key={user.name}
                className={`roster-contact-item ${
                  selectedUser === user.name ? "active" : ""
                }`}
                onClick={() => setSelectedUser(user.name)}
              >
                <div className="contact-avatar">
                  {user.initials}
                  {user.online && <span className="online-indicator"></span>}
                </div>

                <div className="contact-details">
                  <div className="contact-details-top">
                    <strong>{user.name}</strong>
                    <span>{user.time}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--primary-blue)", fontWeight: 500 }}>
                    {user.role}
                  </span>
                  <p className="contact-preview-text">{user.lastMessage}</p>
                </div>
              </button>
            ))}

            {filteredUsers.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12.5px" }}>
                No associates matching "{searchQuery}".
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT CHAT WINDOW */}
        <main className="chat-window">
          {/* HEADER */}
          <div className="chat-window-header">
            <div className="chat-recipient-info">
              <div className="contact-avatar" style={{ width: 42, height: 42 }}>
                {selected.initials}
                {selected.online && <span className="online-indicator"></span>}
              </div>

              <div>
                <h3>{selected.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: selected.online ? "var(--success)" : "#94a3b8",
                    }}
                  ></span>
                  <span style={{ fontSize: "12px", color: selected.online ? "var(--success)" : "var(--text-muted)", fontWeight: 500 }}>
                    {selected.online ? "Online • Active on duty" : "Away • Last seen yesterday"}
                  </span>
                  <span style={{ color: "var(--border-color)" }}>|</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {selected.role}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <span className="badge badge-slate" style={{ fontSize: "11px" }}>
                Firm Member
              </span>
            </div>
          </div>

          {/* MESSAGES STREAM */}
          <div className="chat-messages-container">
            <div className="chat-date-separator">
              Today • Practice Session
            </div>

            {activeMessages.map((msg, index) => (
              <div
                key={index}
                className={`chat-bubble-row ${msg.own ? "outgoing" : "incoming"}`}
              >
                {!msg.own && (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--navy-900)", marginBottom: "3px", paddingLeft: "4px" }}>
                    {msg.sender}
                  </span>
                )}
                <div className="chat-bubble">
                  <p>{msg.text}</p>
                </div>
                <div className="chat-bubble-time" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>{msg.time}</span>
                  {msg.own && <CheckCheck size={13} color="var(--primary-blue)" />}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* COMPOSER INPUT */}
          <div className="chat-input-toolbar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: "50%", width: 38, height: 38, padding: 0 }}
              title="Attach Workpaper or Document"
            >
              <Paperclip size={16} color="var(--text-muted)" />
            </button>

            <input
              type="text"
              className="chat-composer-input"
              placeholder={`Type a message to ${selected.name}... (Press Enter to send)`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ borderRadius: "var(--radius-full)", padding: "10px 18px" }}
              onClick={handleSendMessage}
            >
              <span>Send</span>
              <Send size={14} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default TeamChat;