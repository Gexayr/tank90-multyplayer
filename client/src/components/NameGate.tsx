import { FormEvent, ReactNode, useState } from 'react';
import { cleanName, loadName, NAME_MAX_LENGTH, saveName } from '../lib/player';
import { navigate } from '../lib/router';

interface NameGateProps {
  children: (name: string) => ReactNode;
}

/** Direct links (/open-world, /missions/<code>) still need a nickname first */
const NameGate = ({ children }: NameGateProps) => {
  const [name, setName] = useState(() => cleanName(loadName()));
  const [input, setInput] = useState('');

  if (name) return <>{children(name)}</>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = cleanName(input);
    if (!clean) return;
    saveName(clean);
    setName(clean);
  };

  return (
    <div className="bg-bricks min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="bg-panel border-2 border-line p-6 w-full max-w-sm space-y-4">
        <h1 className="font-pixel text-gold text-sm">ENTER YOUR CALLSIGN</h1>
        <input
          className="w-full bg-ink border-2 border-line px-3 py-3 text-base outline-none focus:border-gold"
          value={input}
          maxLength={NAME_MAX_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tank commander"
          autoFocus
        />
        <div className="flex gap-3">
          <button type="button" className="btn-pixel bg-panel-2 text-white" onClick={() => navigate('/')}>MENU</button>
          <button type="submit" className="btn-pixel bg-gold text-ink flex-1" disabled={!cleanName(input)}>PLAY</button>
        </div>
      </form>
    </div>
  );
};

export default NameGate;
