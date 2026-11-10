const one = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const page = document.body.dataset.page;
const liveSite = ".";
const offline = location.protocol === "file:";

async function profile() {
  if (offline) return null;
  const response = await fetch("/api/profile", {headers:{Accept:"application/json"}});
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Your guest card could not be loaded. Please try again.");
  return response.json();
}
const identity = profile().then(data => {
  if (data?.member) {
    one(".userlink").href = "account.html";
    one(".userlink span").textContent = "Guest card";
  }
  return data;
}).catch(() => undefined);

if (page === "index") {
  const legacy = {"#reviews":"guestbook.html","#menu":"menu.html","#visit":"visit.html"};
  if (legacy[location.hash]) location.replace(legacy[location.hash]);
  const photos = all(".photo-stage img");
  const titles = ["Pizza al forno","Linguine al pomodoro","Tiramisù della casa"];
  let active = 0;
  all("[data-slide]").forEach(button => button.onclick = () => {
    photos[active].classList.remove("current");
    active = (active + Number(button.dataset.slide) + photos.length) % photos.length;
    photos[active].classList.add("current");
    one("#plate").textContent = "0"+(active+1)+" / 03　"+titles[active];
  });
}
if (page === "menu") {
  all("[data-filter]").forEach(button => button.onclick = () => {
    const group = button.dataset.filter;
    all("[data-filter]").forEach(item => item.setAttribute("aria-pressed",String(item===button)));
    all("[data-entry]").forEach(entry => entry.hidden = group!=="All" && entry.dataset.entry!==group);
  });
}
if (page === "guestbook") {
  const notes = [
    ["“We came in for a coffee. Then the pizza went past our table. So much for a quick stop.”","Mira · Sunday lunch"],
    ["“We split the last spoonful of tiramisù. Next time we’re ordering two.”","Arun · Friday supper"],
    ["“A window seat, a plate of linguine and an afternoon we forgot to hurry through.”","Leena · Saturday lunch"]
  ];
  let active = 0;
  all("[data-note]").forEach(button => button.onclick = () => {
    active = (active + Number(button.dataset.note) + notes.length) % notes.length;
    one("#quote").textContent = notes[active][0];
    one("#by").textContent = notes[active][1];
    one("#review-num").textContent = "0"+(active+1)+" / 03";
  });
}
if (page === "book") {
  const form = one("#reserve"), fields = form.elements;
  fields.date.min = new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  for (let hour=10;hour<22;hour++) {
    for (const minutes of ["00","30"]) fields.time.add(new Option(hour+":"+minutes));
  }
  for (let size=1;size<=12;size++) fields.party.add(new Option(size===1?"1 guest":size+" guests",size));
  fields.party.value="2";
  identity.then(data => {if (data?.member && !fields.guest.value) fields.guest.value=data.member.name;});
  form.oninput = () => {for (const field of [fields.guest,fields.date,fields.time]) field.setCustomValidity("");};
  form.onsubmit = event => {
    event.preventDefault();
    const name=fields.guest.value.trim(), date=fields.date.value, time=fields.time.value;
    if (!name) fields.guest.setCustomValidity("Please enter your name.");
    else if (new Date(date+"T12:00:00Z").getUTCDay()===1) fields.date.setCustomValidity("Our kitchen is closed on Mondays.");
    else if (new Date(date+"T"+time+":00+05:30") <= new Date()) fields.time.setCustomValidity("Choose a future time in Bengaluru.");
    if (!form.reportValidity()) return;
    const formatted=new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));
    const message="Hello Tavola! Could I book a table for "+fields.party.value+" on "+formatted+" at "+time+" (Bengaluru time)? The name is "+name+". Please let me know if you have space.";
    one("#message").textContent=message;
    one("#share").href="https://wa.me/?text="+encodeURIComponent(message);
    form.hidden=true;one("#draft").hidden=false;one("#share").focus();
  };
  one("#edit").onclick=()=>{form.hidden=false;one("#draft").hidden=true;fields.guest.focus();};
}
if (page === "signin" || page === "signup") {
  const form = one("#auth");
  if (offline) {
    const link = document.createElement("a");
    link.className = "line";
    link.href = liveSite + "/" + page + ".html";
    link.textContent = page === "signin" ? "Sign in on Tavola" : "Create your Tavola account";
    form.after(link);
    form.hidden = true;
  }
  form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    one(".status").textContent = "";
    try {
      const response = await fetch(form.action, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      location.replace("account.html");
    } catch (error) {
      one(".status").textContent = error instanceof TypeError ? "Couldn’t reach Tavola. Please try again." : error.message;
    } finally {button.disabled=false;}
  };
}
if(page==="account") {
  identity.then(data=>{
    const state=one("#account-state"), actions=one("#account-actions");
    function action(text,href){const link=document.createElement("a");link.className="line";link.textContent=text;link.href=href;if(href.startsWith("/sign"))link.target="_top";actions.append(link);}
    if(!data){
      state.textContent=data===undefined?"We couldn’t load your card.":"Sign in to view your guest card.";
      action(data===undefined?"Try again":"Sign in",data===undefined?"account.html":"signin.html");return;
    }
    if(data.member){
      one("#account-name").textContent=data.member.name;
      state.textContent="Your guest card is ready. We’ll fill in your name when you enquire about a table.";
      action("Book a table ↗","book.html");
    }else{
      state.textContent="You’re signed in. Add your name to create a Tavola guest card.";
      action("Create my guest card ↗","signup.html");
    }
    const logout=document.createElement("button");
    logout.type="button";logout.className="line";logout.textContent="Sign out";actions.append(logout);
    logout.onclick=async()=>{
      logout.disabled=true;
      try {
        const response=await fetch("/api/signout",{method:"POST"});
        if(!response.ok) throw new Error();
        location.replace("signin.html");
      } catch {state.textContent="Sign-out failed. Please try again.";logout.disabled=false;}
    };
  });
}

