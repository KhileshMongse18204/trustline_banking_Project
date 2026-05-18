// Search input typing animation
const searchPhrases = [
  'Search transactions...',
  'Find banks...',
  'Search users...',
  'Look up transfers...'
];

const searchInput = document.getElementById('searchInput');
const searchPlaceholder = document.getElementById('searchPlaceholder');

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 100;
let typingTimer = null;

function typeAnimation() {
  if (!searchPlaceholder) return;

  const currentPhrase = searchPhrases[phraseIndex];

  if (isDeleting) {
    searchPlaceholder.textContent = currentPhrase.substring(0, charIndex - 1);
    charIndex--;
    typingSpeed = 50;
  } else {
    searchPlaceholder.textContent = currentPhrase.substring(0, charIndex + 1);
    charIndex++;
    typingSpeed = 100;
  }

  if (!isDeleting && charIndex === currentPhrase.length) {
    isDeleting = true;
    typingSpeed = 2000;
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % searchPhrases.length;
    typingSpeed = 500;
  }

  typingTimer = setTimeout(typeAnimation, typingSpeed);
}

// Start typing animation when page loads
if (searchPlaceholder) {
  typeAnimation();
}

// Handle input focus/blur
if (searchInput) {
  searchInput.addEventListener('focus', () => {
    searchPlaceholder.style.opacity = '0';
  });

  searchInput.addEventListener('blur', () => {
    if (!searchInput.value) {
      searchPlaceholder.style.opacity = '1';
    }
  });

  searchInput.addEventListener('input', () => {
    searchPlaceholder.style.opacity = searchInput.value ? '0' : '1';
  });
}

// Loader - hide after page loads
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => {
      loader.style.display = 'none';
    }, 500);
  }

  // Check user authentication and display profile
  checkUserAuth();
});

// Check user authentication and update navbar
async function checkUserAuth() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });

    if (!response.ok) return;

    const data = await response.json();
    if (!data.user) return;

    const user = data.user;
    const userProfile = document.getElementById('userProfile');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userIcon = document.getElementById('userIcon');

    if (userProfile && userAvatar && userName) {
      userName.textContent = user.name || user.email || 'User';

      if (user.profile_photo) {
        userAvatar.src = user.profile_photo;
      } else {
        userAvatar.src =
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>';
      }

      userProfile.style.display = 'flex';
      if (userIcon) userIcon.style.display = 'none';
    }
  } catch (error) {
    console.log('User not logged in');
  }
}

// Reusable page redirect helper
function goToPage(page) {
  window.location.href = page;
}

// User icon click handler
document.querySelector('.user-icon')?.addEventListener('click', () => {
  goToPage('Profile.html');
});

// User profile click handler
document.getElementById('userProfile')?.addEventListener('click', () => {
  goToPage('Profile.html');
});

// Terminal button click handler
document.getElementById('terminalBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  goToPage('terminal.html');
});

// Carousel controls
(function () {
  const track = document.getElementById('slidesTrack');
  if (!track) return;

  const total = track.querySelectorAll('.slide').length;
  let cur = 0;
  let timer = null;

  function go(n) {
    cur = (n + total) % total;
    track.style.transform = 'translateX(-' + (cur * 100) + '%)';
    resetTimer();
  }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      go(cur + 1);
    }, 4800);
  }

  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');

  nextBtn?.addEventListener('click', () => go(cur + 1));
  prevBtn?.addEventListener('click', () => go(cur - 1));

  resetTimer();
})();

// Bind homepage action tiles and terminal section/button links
(function bindIntegratedModules() {
  const actionItems = document.querySelectorAll('.action-grid .action-item');

  if (actionItems[0]) {
    actionItems[0].addEventListener('click', () => goToPage('qr-pay.html'));
  }

  if (actionItems[1]) {
    actionItems[1].addEventListener('click', () => goToPage('contact-pay.html'));
  }

  if (actionItems[2]) {
    actionItems[2].addEventListener('click', () => goToPage('bank-link.html'));
  }

  // 4th card = terminal
  if (actionItems[3] && !actionItems[3].classList.contains('action-link')) {
    actionItems[3].addEventListener('click', () => goToPage('terminal.html'));
  }

  // Terminal section CTA / buttons / clickable elements
  document.querySelectorAll(
    '.terminal-section__cta, .terminal-card, #terminal-home .terminal-preview'
  ).forEach((item) => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => goToPage('terminal.html'));
  });

  // Old optional feature/reward bindings if those sections exist
  const rewardCards = Array.from(
    document.querySelectorAll('#features .feature, .rewards .reward')
  );

  rewardCards.forEach((card) => {
    const title = (card.querySelector('h3,strong')?.textContent || '').toLowerCase();

    if (title.includes('rewards')) {
      card.addEventListener('click', () => goToPage('rewards-center.html'));
    }

    if (title.includes('scan')) {
      card.addEventListener('click', () => goToPage('qr-pay.html'));
    }

    if (title.includes('lightning')) {
      card.addEventListener('click', () => goToPage('contact-pay.html'));
    }

    if (title.includes('terminal')) {
      card.addEventListener('click', () => goToPage('terminal.html'));
    }
  });
})();