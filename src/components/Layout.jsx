import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faChartLine, 
  faBox, 
  faCube, 
  faShoppingBag, 
  faChartBar, 
  faCog, 
  faHistory 
} from '@fortawesome/free-solid-svg-icons'
import './Layout.css'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || '')
      }
    }
    getUserEmail()

    // Ascolta i cambiamenti di autenticazione
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || '')
      } else {
        setUserEmail('')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: faChartLine },
    { path: '/materials', label: 'Materiali', icon: faBox },
    { path: '/models', label: 'Modelli', icon: faCube },
    { path: '/products', label: 'Prodotti', icon: faShoppingBag },
    { path: '/reports', label: 'Report', icon: faChartBar },
    { path: '/settings', label: 'Impostazioni', icon: faCog },
  ]

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <img 
            src="/strabello.png" 
            alt="Strabello" 
            className="sidebar-logo"
          />
          <p className="sidebar-header-text">3D Print Manager</p>
        </div>
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
              >
                <span className="nav-icon">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 'auto', padding: '0 20px' }}>
          {/* Sezione Log separata */}
          <div style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '15px',
            marginBottom: '15px'
          }}>
            <Link
              to="/logs"
              className={location.pathname === '/logs' ? 'active' : ''}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 15px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: location.pathname === '/logs' ? '#fff' : '#bdc3c7',
                backgroundColor: location.pathname === '/logs' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              <span className="nav-icon">
                <FontAwesomeIcon icon={faHistory} />
              </span>
              Log Operazioni
            </Link>
          </div>
          {userEmail && (
            <div className="user-email" style={{ 
              padding: '12px 15px', 
              marginBottom: '5px',
              fontSize: '13px',
              color: '#bdc3c7',
              textAlign: 'center',
              wordBreak: 'break-word',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '15px'
            }}>
              {userEmail}
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
