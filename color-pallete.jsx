import React from 'react';

const ColorPaletteShowcase = () => {
  // Color palette
  const colors = {
    accent: [
      { name: 'Cobalt Sky', hex: '#34D399' },
      { name: 'Prussian Blue', hex: '#059669' },
      { name: 'Golden Hour', hex: '#F59E0B' },
      { name: 'Copper Penny', hex: '#EA580C' },
      { name: 'Dark Amber', hex: '#92400E' }
    ],
    base: {
      bgPrimary: '#FAFAF8',
      bgSecondary: '#F5F5F3',
      textPrimary: '#2C2C2C',
      textSecondary: '#6B6B6B',
      borderLight: '#E5E5E3',
      white: '#FFFFFF'
    }
  };

  // Styles object
  const styles = {
    container: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      backgroundColor: colors.base.bgPrimary,
      color: colors.base.textPrimary,
      minHeight: '100vh',
      padding: '0'
    },
    section: {
      padding: '3rem 2rem',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    sectionAlt: {
      backgroundColor: colors.base.bgSecondary
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: '0.5rem'
    },
    subtitle: {
      fontSize: '1.125rem',
      color: colors.base.textSecondary,
      textAlign: 'center',
      marginBottom: '3rem'
    },
    sectionTitle: {
      fontSize: '2rem',
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: '2rem'
    },
    colorGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1.5rem',
      marginBottom: '3rem'
    },
    colorCard: {
      backgroundColor: colors.base.white,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      transition: 'all 0.2s',
      cursor: 'pointer'
    },
    colorSwatch: {
      height: '120px',
      width: '100%'
    },
    colorInfo: {
      padding: '1rem'
    },
    colorName: {
      fontSize: '1rem',
      fontWeight: '600',
      marginBottom: '0.25rem'
    },
    colorHex: {
      fontSize: '0.875rem',
      color: colors.base.textSecondary,
      fontFamily: 'monospace'
    },
    baseColors: {
      display: 'flex',
      gap: '2rem',
      justifyContent: 'center',
      flexWrap: 'wrap',
      paddingTop: '2rem',
      borderTop: `1px solid ${colors.base.borderLight}`
    },
    baseColorItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem'
    },
    baseSwatch: {
      width: '40px',
      height: '40px',
      borderRadius: '8px',
      border: `2px solid ${colors.base.borderLight}`
    },
    componentGrid: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '1rem',
      justifyContent: 'center',
      marginBottom: '2rem'
    },
    button: {
      padding: '0.75rem 1.5rem',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '1rem',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontFamily: 'inherit'
    },
    buttonOutline: {
      backgroundColor: 'transparent',
      border: '2px solid'
    },
    cardsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '1.5rem'
    },
    card: {
      backgroundColor: colors.base.white,
      borderRadius: '12px',
      padding: '1.5rem',
      border: '2px solid',
      transition: 'all 0.3s'
    },
    cardIcon: {
      width: '48px',
      height: '48px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.5rem',
      marginBottom: '1rem'
    },
    alert: {
      padding: '1rem 1.5rem',
      borderRadius: '8px',
      borderLeft: '4px solid',
      marginBottom: '1rem',
      maxWidth: '600px',
      margin: '0 auto 1rem'
    },
    badge: {
      padding: '0.375rem 0.875rem',
      borderRadius: '20px',
      fontSize: '0.875rem',
      fontWeight: '600',
      display: 'inline-block',
      color: colors.base.white
    },
    progressBar: {
      width: '100%',
      maxWidth: '600px',
      height: '12px',
      backgroundColor: colors.base.borderLight,
      borderRadius: '6px',
      overflow: 'hidden',
      margin: '0 auto 1.5rem'
    },
    progressFill: {
      height: '100%',
      borderRadius: '6px',
      transition: 'width 0.3s ease'
    },
    input: {
      width: '100%',
      maxWidth: '500px',
      padding: '0.75rem',
      border: `2px solid ${colors.base.borderLight}`,
      borderRadius: '8px',
      fontSize: '1rem',
      margin: '0 auto 1rem',
      display: 'block',
      fontFamily: 'inherit',
      backgroundColor: colors.base.white
    }
  };

  return (
    <div style={styles.container}>
      {/* Color Palette Section */}
      <div style={styles.section}>
        <h1 style={styles.title}>Color Palette</h1>
        <p style={styles.subtitle}>A vibrant and harmonious color system for modern web design</p>
        
        {/* Accent Colors */}
        <div style={styles.colorGrid}>
          {colors.accent.map((color, index) => (
            <div 
              key={index} 
              style={styles.colorCard}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
              }}
            >
              <div style={{ ...styles.colorSwatch, backgroundColor: color.hex }} />
              <div style={styles.colorInfo}>
                <div style={styles.colorName}>{color.name}</div>
                <div style={styles.colorHex}>{color.hex}</div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Base Colors */}
        <div style={styles.baseColors}>
          <div style={styles.baseColorItem}>
            <div style={{ ...styles.baseSwatch, backgroundColor: colors.base.bgPrimary }} />
            <div>
              <strong>Background</strong><br />
              <code style={{ fontSize: '0.875rem' }}>#FAFAF8</code>
            </div>
          </div>
          <div style={styles.baseColorItem}>
            <div style={{ ...styles.baseSwatch, backgroundColor: colors.base.textPrimary }} />
            <div>
              <strong>Text Primary</strong><br />
              <code style={{ fontSize: '0.875rem' }}>#2C2C2C</code>
            </div>
          </div>
          <div style={styles.baseColorItem}>
            <div style={{ ...styles.baseSwatch, backgroundColor: colors.base.textSecondary }} />
            <div>
              <strong>Text Secondary</strong><br />
              <code style={{ fontSize: '0.875rem' }}>#6B6B6B</code>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons Section */}
      <div style={{ ...styles.section, ...styles.sectionAlt }}>
        <h2 style={styles.sectionTitle}>Buttons</h2>
        <div style={styles.componentGrid}>
          {colors.accent.map((color, index) => (
            <button 
              key={index}
              style={{ ...styles.button, backgroundColor: color.hex, color: 'white' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {color.name}
            </button>
          ))}
        </div>
        <div style={styles.componentGrid}>
          {colors.accent.map((color, index) => (
            <button 
              key={index}
              style={{ ...styles.button, ...styles.buttonOutline, borderColor: color.hex, color: color.hex }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Outline {color.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Cards</h2>
        <div style={styles.cardsGrid}>
          {colors.accent.slice(0, 3).map((color, index) => (
            <div 
              key={index}
              style={{ ...styles.card, borderColor: color.hex }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ 
                ...styles.cardIcon, 
                backgroundColor: color.hex + '1A',
                color: color.hex 
              }}>
                {['◆', '◈', '✦'][index]}
              </div>
              <h3 style={{ marginBottom: '0.5rem' }}>{color.name} Card</h3>
              <p style={{ color: colors.base.textSecondary, marginBottom: '1rem' }}>
                This card uses the {color.name} accent color for its border and icon styling.
              </p>
              <a href="#" style={{ color: color.hex, fontWeight: '600', textDecoration: 'none' }}>
                Learn more →
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      <div style={{ ...styles.section, ...styles.sectionAlt }}>
        <h2 style={styles.sectionTitle}>Alerts</h2>
        <div style={{ ...styles.alert, backgroundColor: colors.accent[0].hex + '1A', borderColor: colors.accent[0].hex }}>
          <strong>Success!</strong> Your changes have been saved successfully.
        </div>
        <div style={{ ...styles.alert, backgroundColor: colors.accent[1].hex + '1A', borderColor: colors.accent[1].hex }}>
          <strong>Info:</strong> New features are now available in your dashboard.
        </div>
        <div style={{ ...styles.alert, backgroundColor: colors.accent[2].hex + '1A', borderColor: colors.accent[2].hex }}>
          <strong>Warning:</strong> Your trial period ends in 3 days.
        </div>
        <div style={{ ...styles.alert, backgroundColor: colors.accent[3].hex + '1A', borderColor: colors.accent[3].hex }}>
          <strong>Error:</strong> Unable to process your request at this time.
        </div>
      </div>

      {/* Badges Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Badges & Tags</h2>
        <div style={styles.componentGrid}>
          {colors.accent.map((color, index) => (
            <span key={index} style={{ ...styles.badge, backgroundColor: color.hex }}>
              {color.name}
            </span>
          ))}
        </div>
      </div>

      {/* Progress Bars Section */}
      <div style={{ ...styles.section, ...styles.sectionAlt }}>
        <h2 style={styles.sectionTitle}>Progress Indicators</h2>
        {colors.accent.map((color, index) => (
          <div key={index} style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              {color.name} Progress - {[75, 60, 90, 45, 85][index]}%
            </label>
            <div style={styles.progressBar}>
              <div style={{ 
                ...styles.progressFill, 
                width: `${[75, 60, 90, 45, 85][index]}%`,
                backgroundColor: color.hex 
              }} />
            </div>
          </div>
        ))}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Gradient Progress - 100%
          </label>
          <div style={styles.progressBar}>
            <div style={{ 
              ...styles.progressFill, 
              width: '100%',
              background: `linear-gradient(90deg, ${colors.accent.map(c => c.hex).join(', ')})` 
            }} />
          </div>
        </div>
      </div>

      {/* Form Elements Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Form Elements</h2>
        <input 
          type="text" 
          placeholder="Enter some text..." 
          style={styles.input}
          onFocus={(e) => {
            e.target.style.borderColor = colors.accent[3].hex;
            e.target.style.boxShadow = `0 0 0 3px ${colors.accent[3].hex}1A`;
            e.target.style.outline = 'none';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = colors.base.borderLight;
            e.target.style.boxShadow = 'none';
          }}
        />
        <select style={styles.input}>
          <option>Choose an option</option>
          <option>Option 1</option>
          <option>Option 2</option>
          <option>Option 3</option>
        </select>
        <textarea 
          rows="3" 
          placeholder="Enter your message..." 
          style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {/* Footer */}
      <div style={{ 
        backgroundColor: colors.base.textPrimary, 
        color: 'white', 
        padding: '2rem',
        textAlign: 'center'
      }}>
        <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1rem' }}>
          Color Palette Showcase · Built with React
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {colors.accent.map((color, index) => (
            <span 
              key={index}
              style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: color.hex, 
                borderRadius: '50%',
                display: 'inline-block'
              }} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPaletteShowcase;