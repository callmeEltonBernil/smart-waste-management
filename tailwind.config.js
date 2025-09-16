module.exports = {
  content: ['./*.html', './*.js'],
  theme: {
    extend: {
      colors: {
        primary: '#28a745',
        'primary-dark': '#218838',
        'success': '#28a745',
        'warning': '#ffc107',
        'danger': '#dc3545',
        'info': '#17a2b8'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}