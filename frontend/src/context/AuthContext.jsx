import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('divesafe_token');
    const usuarioGuardado = localStorage.getItem('divesafe_usuario');
    if (token && usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado));
    }
    setCargando(false);
  }, []);

  async function login(nombreUsuario, password) {
    const { token, usuario: usuarioLogueado } = await api.login(nombreUsuario, password);
    localStorage.setItem('divesafe_token', token);
    localStorage.setItem('divesafe_usuario', JSON.stringify(usuarioLogueado));
    setUsuario(usuarioLogueado);
    return usuarioLogueado;
  }

  function logout() {
    localStorage.removeItem('divesafe_token');
    localStorage.removeItem('divesafe_usuario');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando, esAdmin: usuario?.rol === 'Administrador' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
