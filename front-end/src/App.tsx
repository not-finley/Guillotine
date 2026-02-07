import './App.css';
import { Navigate, Route, Routes } from 'react-router-dom';
import Create from './_create/Create';
import CreateRoom from './_create/forms/CreateRoom';
import JoinRoom from './_create/forms/JoinRoom';
import socket from './components/socket';
import { useEffect } from 'react';
import Room from './_root/Room';
import Game2 from './_root/Game2';

function App() {
  useEffect(() => {
    socket.connect();
  
    return () => {
      socket.disconnect();
    };
  }, []);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/room/create" />} />
      <Route element={<Create />}>
        <Route path="/room/create" element={<CreateRoom />}/>
        <Route path="/room/join" element={<JoinRoom />}/>
      </Route>
      <Route path="/room/:roomCode" element={<Room />} />
      <Route path="/game/:roomCode" element={<Game2 />} />
    </Routes>
  )
}

export default App
