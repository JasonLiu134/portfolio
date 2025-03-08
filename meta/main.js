let data = [];
updateTooltipVisibility(false);

async function loadData() {
    data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line),
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
    }));
    processCommits();
    displayStats();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  updateScatterplot(commits);
  brushSelector();
  renderItems(0);
  displayCommitFiles(0);
  renderDots();
});

let commits = [];
let filteredCommits = [];
let selectedCommits = [];
let filteredData = [];

function enableTimeSlider() {
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    let commitProgress = 100;
    let timeScale = d3.scaleTime([d3.min(commits, d => d.datetime), d3.max(commits, d => d.datetime)], [0, 100]);
    let commitMaxTime = timeScale.invert(commitProgress);

    function updateTimeDisplay() {
        const timeFilter = Number(timeSlider.value);
        commitMaxTime = timeScale.invert(timeFilter)
        selectedTime.textContent = formatTime(timeScale.invert(timeFilter));
        filteredCommits = commits.filter(commit => commit.datetime <= commitMaxTime);
        updateScatterplot(filteredCommits);
        brushSelector();
        selectedCommits = [];
        updateSelectionCount();
        updateLanguageBreakdown();
        fileDetails(0);
        displayStats();
    }

    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();

    function formatTime(input) {
        return input.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    }  
}

function processCommits() {
commits = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
        let first = lines[0];
        let { author, date, time, timezone, datetime } = first;
        let ret = {
            id: commit,
            url: 'https://github.com/jasonliu134/portfolio/commit/' + commit,
            author,
            date,
            time,
            timezone,
            datetime,
            hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
            totalLines: lines.length,
        };

        Object.defineProperty(ret, 'lines', {
            value: lines,
            configurable: false,
            writable: false,
            enumerable: false,
          });
        
        return ret;
    });

commits = d3.sort(commits, (d) => d.datetime.getTime());
}

function displayStats() {
    const filteredData = data.filter(d => filteredCommits.some(c => c.id === d.commit));
    d3.select('#stats').select('dl').remove();

    const dl = d3.select('#stats').append('dl').attr('class', 'stats');
    dl.append('dt').text('Total Commits');
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dt').text('Total Files');
    dl.append('dt').text('Max File Length');
    dl.append('dt').html('<abbr title="Average">AVG</abbr> File Length');
    dl.append('dt').html('<abbr title="Average">AVG</abbr> Line Length');

    dl.append('dd').text(filteredCommits.length);
    dl.append('dd').text(filteredData.length);
    dl.append('dd').text(d3.groups(filteredData, d => d.file).length);

    const fileLengths = d3.rollups(filteredData, (v) => d3.max(v, (v) => v.line), (d) => d.file);
    const lineLengths = d3.rollups(filteredData, (v) => d3.max(v, (v) => v.length), (d) => d.file);
    dl.append('dd').text(Math.round(d3.max(fileLengths, (d) => d[1]) * 10) / 10);
    dl.append('dd').text(Math.round(d3.mean(fileLengths, (d) => d[1]) * 10) / 10);
    dl.append('dd').text(Math.round(d3.mean(lineLengths, (d) => d[1]) * 10) / 10);
}

let xScale;
let yScale;

function updateScatterplot(filteredCommits) {
    const sortedCommits = d3.sort(filteredCommits, (d) => -d.totalLines);
    const width = 1000;
    const height = 600;

    d3.select('svg').remove();
    const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

    xScale = d3
    .scaleTime()
    .domain(d3.extent(filteredCommits, (d) => d.datetime))
    .range([0, width])
    .nice();

    yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

    const margin = { top: 10, right: 10, bottom: 30, left: 20 };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };
    
    xScale.range([usableArea.left, usableArea.right]);
    yScale.range([usableArea.bottom, usableArea.top]);

    const gridlines = svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

    gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width)).style('opacity', 0.1);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

    svg.selectAll('g').remove();

    svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

    svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

    const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 20]);

    const dots = svg.append('g').attr('class', 'dots');
    dots.selectAll('circle').remove(); 
    
    dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .style('--r', (d) => rScale(d.totalLines))
    .on('mouseenter', function (event, d, i) {
        d3.select(event.currentTarget).style('fill-opacity', 1);
        updateTooltipContent(d);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
        d3.select(event.currentTarget).classed('selected', true);
    })
    .on('mouseleave', function () {
        d3.select(event.currentTarget).style('fill-opacity', 0.7);
        updateTooltipContent({});
        updateTooltipVisibility(false);
        d3.select(event.currentTarget).classed('selected', false);
    });
}

function updateTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');
  
    if (Object.keys(commit).length === 0) return;
  
    link.href = commit.url;
    link.textContent = commit.id;
    date.textContent = commit.datetime?.toLocaleString('en', {
      dateStyle: 'full',
    });
}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX}px`;
    tooltip.style.top = `${event.clientY}px`;
}

function brushSelector() {
    const svg = document.querySelector('svg');
    d3.select(svg).call(d3.brush().on('start brush end', brushed));
    d3.select(svg).selectAll('.dots, .overlay ~ *').raise();
}

let brushSelection = null;

function brushed(evt) {
    let brushSelection = evt.selection;
    selectedCommits = !brushSelection
      ? []
      : filteredCommits.filter((commit) => {
          let min = { x: brushSelection[0][0], y: brushSelection[0][1] };
          let max = { x: brushSelection[1][0], y: brushSelection[1][1] };
          let x = xScale(commit.date);
          let y = yScale(commit.hourFrac);
  
          return x >= min.x && x <= max.x && y >= min.y && y <= max.y;
        });
    updateSelection();
    updateSelectionCount();
    updateLanguageBreakdown();
  }

function updateSelection() {
    d3.selectAll('circle').classed('selected', (d) => isCommitSelected(d));
}

function isCommitSelected(commit) {
    return selectedCommits.includes(commit);
}

function updateSelectionCount() {  
    const countElement = document.getElementById('selection-count');
    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;
  
    return selectedCommits;
}

function updateLanguageBreakdown() {
    const container = document.getElementById('language-breakdown');
  
    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }
    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines);
    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type
    );
  
    container.innerHTML = '';
  
    for (const [language, count] of breakdown) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);
  
      container.innerHTML += `
              <dt>${language}</dt>
              <dd>${count} lines (${formatted})</dd>
          `;
    }
  
    return breakdown;
}

function fileDetails(endIndex) {
    let newCommitSlice = commits.slice(0, endIndex + 1);
    let lines = newCommitSlice.flatMap((d) => d.lines);
    let files = [];
    files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
        return { name, lines };
    });

    files = d3.sort(files, (d) => -d.lines.length);
    let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);

    d3.select('.files').selectAll('div').remove();
    let filesContainer = d3.select('.files').selectAll('div').data(files).enter().append('div');
    filesContainer.append('dt').append('code').text(d => d.name).append('small').html(d => `${d.lines.length} lines`);
    filesContainer.append('dd').attr('class', 'linedd')
        .selectAll('div')
        .data(d => d.lines).enter()
        .append('div').attr('class', 'line')
        .style('background', fileTypeColors);
}

let NUM_ITEMS = 31; // Ideally, let this value be the length of your commit history
let ITEM_HEIGHT = 140; // Feel free to change
let VISIBLE_COUNT = 10; // Feel free to change as well
let totalHeight = (NUM_ITEMS + 1.5) * ITEM_HEIGHT;
const scrollContainer = d3.select('#scroll-container');
const spacer = d3.select('#spacer');
spacer.style('height', `${totalHeight}px`);
const itemsContainer = d3.select('#items-container');
scrollContainer.on('scroll', () => {
  const scrollTop = scrollContainer.property('scrollTop');
  let curIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  renderItems(curIndex);
});

function renderItems(endIndex) {
    // Clear things off
    itemsContainer.selectAll('div').remove();
    let newCommitSlice = commits.slice(0, endIndex + 1);
    // TODO: how should we update the scatterplot (hint: it's just one function call)
    updateScatterplot(newCommitSlice);
    filteredCommits = newCommitSlice;
    selectedCommits = [];
    updateSelectionCount();
    updateLanguageBreakdown();
    displayStats();
    brushSelector();

    // Re-bind the commit data to the container and represent each using a div
    itemsContainer.selectAll('div')
                  .data(commits)
                  .enter()
                  .append('div')
                  .each(function (commit, idx) {
                    d3.select(this).html(`
                        <p>
                            On ${new Date(commit.datetime).toLocaleString("en", {dateStyle: "full", timeStyle: "short"})}, I made
                            <a href="${commit.url}" target="_blank">
                                ${idx > 0 ? 'another commit to my portfolio' : 'my first commit, creating this portfolio'}
                            </a>. I edited ${commit.totalLines} lines across ${d3.rollups(commit.lines, D => D.length, d => d.file).length} files. 
                            Although these updates were for a lab submission, I learned a lot from completing the assignment, and improved my knowledge of web development.
                        </p>
                    `);
                })
                  .style('position', 'absolute')
                  .style('top', (_, idx) => `${idx * ITEM_HEIGHT}px`)
}

function displayCommitFiles(index) {
    let newCommitSlice = commits.slice(0, index + 1);
    const lines = newCommitSlice.flatMap((d) => d.lines);
    let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
    let files = d3.groups(lines, (d) => d.file).map(([name, lines]) => {
      return { name, lines };
    });
    files = d3.sort(files, (d) => -d.lines.length);
    d3.select('.files').selectAll('div').remove();
    let filesContainer = d3.select('.files').selectAll('div').data(files).enter().append('div').attr('class', 'test');
    filesContainer.append('dt').html(d => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);
    filesContainer.append('dd').attr('class', 'linedd')
                  .selectAll('div')
                  .data(d => d.lines)
                  .enter()
                  .append('div')
                  .attr('class', 'line')
                  .style('background', d => fileTypeColors(d.type));
  }

  let currentFileNum = 0;
  let currentLineLens = 0;
  function renderDots() {
    // Clear things off
    dotsContainer.selectAll('div').remove();

    let totalFilteredData = []
    let totalFileNum = 0;

    // Re-bind the commit data to the container and represent each using a div
    dotsContainer.selectAll('div')
                  .data(commits)
                  .enter()
                  .append('div')
                  .each(function (commit, idx) {
                    const filteredData = data.filter(d => d.commit === commit.id);
                    totalFilteredData.push(...filteredData);
                    const numFiles = (new Set(totalFilteredData.map(item => item.file))).size;
                    d3.select(this).html(`
                        <p>
                            On ${new Date(commit.datetime).toLocaleString("en", {dateStyle: "full", timeStyle: "short"})}, I made
                            <a href="${commit.url}" target="_blank">
                                ${idx > 0 ? 'another commit to my portfolio' : 'my first commit, creating my first file in the portfolio'}
                            </a>. There are currently ${numFiles} files, and ${totalFilteredData.length} total lines. 
                        </p>
                    `);
                })
                  .style('position', 'absolute')
                  .style('top', (_, idx) => `${idx * ITEM_HEIGHT_DOTS}px`)
}

let ITEM_HEIGHT_DOTS = 100; // Feel free to change
let totalHeightDots = (NUM_ITEMS + 2.5) * ITEM_HEIGHT_DOTS;
const scrollContainerDots = d3.select('#scroll-container-dots');
const spacerDots = d3.select('#spacer-dots');
spacerDots.style('height', `${totalHeightDots}px`);
const dotsContainer = d3.select('#dots-container');
scrollContainerDots.on('scroll', () => {
  const scrollTopDots = scrollContainerDots.property('scrollTop');
  let curIndex = Math.floor(scrollTopDots / ITEM_HEIGHT_DOTS);
   displayCommitFiles(curIndex);
});