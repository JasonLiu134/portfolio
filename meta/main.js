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

    displayStats();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  createScatterplot();
  brushSelector();
});

let commits = [];

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
}

function displayStats() {
    processCommits();

    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    dl.append('dt').text('Total Commits');
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dt').text('Total Files');
    dl.append('dt').text('Max File Length');
    dl.append('dt').html('<abbr title="Average">AVG</abbr> File Length');
    dl.append('dt').html('<abbr title="Average">AVG</abbr> Line Length');

    dl.append('dd').text(commits.length);
    dl.append('dd').text(data.length);
    dl.append('dd').text(d3.groups(data, d => d.file).length);

    const fileLengths = d3.rollups(data, (v) => d3.max(v, (v) => v.line), (d) => d.file);
    const lineLengths = d3.rollups(data, (v) => d3.max(v, (v) => v.length), (d) => d.file);
    dl.append('dd').text(d3.max(fileLengths, (d) => d[1]));
    dl.append('dd').text(d3.mean(fileLengths, (d) => d[1]));
    dl.append('dd').text(d3.mean(lineLengths, (d) => d[1]));
}

let xScale;
let yScale;

function createScatterplot() {
    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
    const width = 1000;
    const height = 600;

    const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

    xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
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

    svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

    svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 20]);

    const dots = svg.append('g').attr('class', 'dots');
    dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', function (event, d, i) {
        d3.select(event.currentTarget).style('fill-opacity', 1);
        updateTooltipContent(d);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
    })
    .on('mouseleave', function () {
        d3.select(event.currentTarget).style('fill-opacity', 0.7);
        updateTooltipContent({});
        updateTooltipVisibility(false);
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

function brushed(event) {
    brushSelection = event.selection;
    updateSelection();
    updateSelectionCount();
    updateLanguageBreakdown();
}

function updateSelection() {
    d3.selectAll('circle').classed('selected', (d) => isCommitSelected(d));
}

function isCommitSelected(commit) {
    if (!brushSelection) {
      return false;
    }

    const min = {x: brushSelection[0][0], y: brushSelection[0][1]}; 
    const max = {x: brushSelection[1][0], y: brushSelection[1][1]}; 
    const x = xScale(commit.date); 
    const y = yScale(commit.hourFrac); 
    return x >= min.x && x <= max.x && y >= min.y && y <= max.y; 
}

function updateSelectionCount() {
    const selectedCommits = brushSelection
      ? commits.filter(isCommitSelected)
      : [];
  
    const countElement = document.getElementById('selection-count');
    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;
  
    return selectedCommits;
}

function updateLanguageBreakdown() {
    const selectedCommits = brushSelection
      ? commits.filter(isCommitSelected)
      : [];
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












































