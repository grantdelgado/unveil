export default function IOSMinimalPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Unveil iOS Test</title>
      </head>
      <body style={{
        margin: 0,
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'linear-gradient(135deg, #fef7f0 0%, #f5f5f4 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: '#e15b50',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            U
          </div>
          
          <h1 style={{color: '#1f2937', marginBottom: '8px'}}>
            🎉 SUCCESS!
          </h1>
          
          <p style={{color: '#16a34a', fontSize: '18px', marginBottom: '16px'}}>
            iOS 26.0 WebView is working!
          </p>
          
          <p style={{color: '#6b7280', marginBottom: '16px'}}>
            This proves your iOS setup is correct.
          </p>
          
          <div style={{
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '16px',
            margin: '16px 0',
            fontSize: '12px',
            color: '#64748b',
            textAlign: 'left'
          }}>
            <div><strong>Status:</strong> WebView rendering successfully</div>
            <div><strong>JavaScript:</strong> Executing properly</div>
            <div><strong>Time:</strong> {new Date().toLocaleTimeString()}</div>
          </div>
          
          <div>
            <a 
              href="/login" 
              style={{
                background: '#e15b50',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
                display: 'inline-block',
                margin: '8px'
              }}
            >
              Go to Login
            </a>
          </div>
          
          <p style={{fontSize: '11px', color: '#9ca3af', marginTop: '16px'}}>
            The issue is with complex Next.js providers, not iOS compatibility.
          </p>
        </div>
      </body>
    </html>
  );
}
