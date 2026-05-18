(function(){
  window.TrustLineApp = {
    async api(url, options = {}) {
      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      let data = null;
      try { data = await response.json(); } catch (e) {}
      if (!response.ok) {
        const message = data?.error || data?.message || 'Something went wrong';
        throw new Error(message);
      }
      return data;
    },
    money(value){
      const amount = Number(value || 0);
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
    },
    dateTime(value){
      try { return new Date(value).toLocaleString('en-IN'); } catch(e) { return value || ''; }
    },
    initials(text){
      return String(text || 'U').trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join('') || 'U';
    },
    ensureToastRoot(){
      let root = document.querySelector('.toast-wrap');
      if (!root) {
        root = document.createElement('div');
        root.className = 'toast-wrap';
        document.body.appendChild(root);
      }
      return root;
    },
    toast(title, message){
      const root = this.ensureToastRoot();
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-message">${message}</div>`;
      root.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    },
    async requireAuth(){
      try {
        const data = await this.api('/api/auth/me');
        return data.user;
      } catch (error) {
        window.location.href = 'Sign.html';
        throw error;
      }
    },
    bindProfileCard(){
      const userProfile = document.getElementById('userProfile');
      const userAvatar = document.getElementById('userAvatar');
      const userName = document.getElementById('userName');
      const userIcon = document.getElementById('userIcon');
      this.api('/api/auth/me').then((data) => {
        const user = data.user;
        if (!userProfile || !userAvatar || !userName) return;
        userName.textContent = user.name || user.email || 'User';
        if (user.profile_photo) userAvatar.src = user.profile_photo;
        else userAvatar.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%2300E5FF"/><text x="50%25" y="54%25" text-anchor="middle" fill="%23071029" font-size="16" font-family="Arial" font-weight="bold">${encodeURIComponent(this.initials(user.name || user.email))}</text></svg>`;
        userProfile.style.display = 'flex';
        if (userIcon) userIcon.style.display = 'none';
      }).catch(()=>{});
    }
  };
})();
