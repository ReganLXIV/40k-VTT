import { useGame } from './state/gameStore';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

export default function App() {
  const inRoom = useGame((s) => !!s.state && !!s.code);
  return inRoom ? <Game /> : <Lobby />;
}
