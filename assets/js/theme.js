/* Theme module — commun à TOUTES les pages */
window.Theme=(function(){
  const KEY='ui:theme'; // 'light' | 'dark'
  let canWrite=false;

  const mqLight = matchMedia('(prefers-color-scheme: light)');

  function read(){
    return localStorage.getItem(KEY) || (mqLight.matches ? 'light' : 'dark');
  }

  function apply(mode){
    const root = document.documentElement;
    const isLight = (mode==='light');
    if(isLight) root.setAttribute('data-theme','light');
    else root.removeAttribute('data-theme'); // 'dark' = défaut

    // accessibilité / synchro bouton si présent
    const btn=document.getElementById('themeBtn');
    if(btn){
      btn.dataset.state = mode;
      btn.classList.toggle('is-light', isLight);
      btn.classList.toggle('is-dark',  !isLight);
      btn.setAttribute('aria-pressed', !isLight);
      btn.title = `Mode sélectionné: ${isLight?'clair':'foncé'}`;
    }

    // Meta theme-color pour la barre d’adresse mobile
    const metaTheme=document.querySelector('meta[name="theme-color"]');
    if(metaTheme) metaTheme.setAttribute('content', isLight ? '#f7f9fc' : '#0b1220');
  }

  function set(mode){
    if(!canWrite) return;
    localStorage.setItem(KEY, mode);
    apply(mode);
  }

  function toggle(){
    set(read()==='light' ? 'dark' : 'light');
  }

  function init(opts={}){
    canWrite = !!opts.canWrite;
    apply(read());

    // changement système (si aucun choix stocké)
    mqLight.addEventListener('change', e=>{
      if(!localStorage.getItem(KEY)) apply(e.matches?'light':'dark');
    });

    // synchro multi-onglets
    window.addEventListener('storage', (e)=>{
      if(e.key===KEY) apply(e.newValue || (mqLight.matches?'light':'dark'));
    });

    // brancher éventuel bouton
    const btn=document.getElementById('themeBtn');
    if(btn){
      if(!canWrite){
        // en lecture seule, on peut désactiver visuellement ou laisser cliquable selon préférence
        btn.disabled = true;
        btn.style.cursor='not-allowed';
        btn.title='Le thème se change depuis la page d’accueil';
      }else{
        btn.addEventListener('click', toggle);
      }
    }
  }

  return { init, apply, toggle, set, read };
})();
