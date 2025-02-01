console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let pages = [
  { url: '', title: 'Home' },
  { url: 'contact/', title: 'Contact' },
  { url: 'projects/', title: 'Projects' },
  { url: 'https://github.com/JasonLiu134', title: 'GitHub' },
  { url: 'resume/', title: 'Resume' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);
const ARE_WE_HOME = document.documentElement.classList.contains('home');

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  if (!ARE_WE_HOME && !url.startsWith('http')) {
    url = '../' + url;
  }

  let a = document.createElement('a');
  
  a.href = url;
  a.textContent = title;
  nav.append(a);

  if (a.host !== location.host) {
    a.target = "_blank"
  }

  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname
  );

}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
	<label class="color-scheme">
		Theme:
		<select>
			<option value = "Light Dark"> Automatic </option>
      <option value = "Light"> Light </option>
      <option value = "Dark"> Dark </option>
		</select>
	</label>`
);

let select = document.querySelector(":root")

if ("colorScheme" in localStorage) {
  document.documentElement.style.setProperty('color-scheme', localStorage.colorScheme);

  let updateSelect = document.querySelector('select');
  updateSelect.value = localStorage.colorScheme;
}

select.addEventListener('input', function (event) {
  console.log('color scheme changed to', event.target.value);
  document.documentElement.style.setProperty('color-scheme', event.target.value);
  localStorage.colorScheme = event.target.value
});

export async function fetchJSON(url) {
  try {
      // Fetch the JSON file from the given URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    
      const data = await response.json();
      return data; 


  } catch (error) {
      console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(project, containerElement, headingLevel = 'h2') {
  containerElement.innerHTML = '';
  for (let proj of project){
    const article = document.createElement('article');
    article.innerHTML = `
      <${headingLevel}>${proj.title} (${proj.year})</${headingLevel}>
      <img src="${proj.image}" alt="${proj.title}">
      <p>${proj.description}</p>
    `;
    containerElement.appendChild(article);
  }
}

export function countProjects(project) {
  const title = document.querySelector('.projects-title');
  title.innerHTML = `${project.length} Projects`;
}

export async function fetchGitHubData(username) {
  // return statement here
  return fetchJSON(`https://api.github.com/users/${username}`);
}
