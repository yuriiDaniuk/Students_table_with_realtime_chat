import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Students from './Students';
import Dashboard from './Dashboard';
import Tasks from './Tasks';
import Messages from './Message';
import { Socket } from 'socket.io-client';
import { SocketProvider } from './SocketContext';

function App() {
  return (
    <SocketProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/" element={<Students />} /> 
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/messages" element={<Messages />} />
          </Routes>
        </Layout>
      </Router>
    </SocketProvider>
  );
}

export default App;