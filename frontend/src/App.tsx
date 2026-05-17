import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthState } from './hooks/useAuth';
import Home from './pages/Home';
import Login from './pages/Login';
import CreateRecord from './pages/CreateRecord';
import Profile from './pages/Profile';
import Navbar from './components/Navbar';

function App() {
  const auth = useAuthState();

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-warm animate-pulse">
            <span className="text-2xl">💰</span>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-orange-400 border-t-transparent mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/login"
                element={auth.user ? <Navigate to="/" replace /> : <Login />}
              />
              <Route
                path="/create"
                element={auth.user ? <CreateRecord /> : <Navigate to="/" replace />}
              />
              <Route
                path="/profile"
                element={auth.user ? <Profile /> : <Navigate to="/" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
