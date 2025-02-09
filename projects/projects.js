import { fetchJSON, renderProjects, countProjects } from '../global.js';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');
countProjects(projects);

function renderPieChart(projectsGiven) {
    // Clear old data
    let newSVG = d3.select('svg'); 
    newSVG.selectAll('path').remove();
    d3.select('.legend').selectAll('li').remove();

    // re-calculate rolled data
    let newRolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year,
    );
    // re-calculate data
    let newData = newRolledData.map(([year, count]) => {
        return { value: count, label: year }
    });

    // re-calculate slice generator, arc data, arc, etc.
    let newArcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let newSliceGenerator = d3.pie().value((d) => d.value);
    let newArcData = newSliceGenerator(newData);
    let newArcs = newArcData.map((d) => newArcGenerator(d));

    let colors = d3.scaleOrdinal(d3.schemeTableau10);
    newArcs.forEach((arc, idx) => {
        d3.select('svg')
        .append('path')
        .attr('d', arc)
        .attr('fill', colors(idx))
    })

    let legend = d3.select('.legend');
    newData.forEach((d, idx) => {
        legend.append('li')
            .attr('style', `--color:${colors(idx)}`)
            .attr('class', 'legend_class')
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
    })

    let selectedIndex = -1;
    let svg = d3.select('svg');
    svg.selectAll('path').remove();
    newArcs.forEach((arc, i) => {
    svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(i))
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;
        
        svg.selectAll('path').attr('class', (_, idx) => {
            return idx === selectedIndex ? 'selected' : '';
        });

        legend
          .selectAll('li')
          .attr('class', (_, idx) => {
            return idx === selectedIndex ? 'legend_class selected' : 'legend_class';
          });

        if (selectedIndex === -1) {
            renderProjects(projectsGiven, projectsContainer, 'h2');
          } else {
            let filteredProjects = projectsGiven.filter(
              project => project.year === newData[selectedIndex].label);
            renderProjects(filteredProjects, projectsContainer, 'h2');
          }
      });
  });
}

renderPieChart(projects);

let query = '';
let searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('input', (event) => {
  query = event.target.value;

  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);
});