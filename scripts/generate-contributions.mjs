import { mkdir, writeFile } from 'node:fs/promises'

const token = process.env.PROFILE_TOKEN
if (!token) throw new Error('PROFILE_TOKEN is required')

const query = `query {
  viewer {
    login
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount contributionLevel weekday }
        }
      }
    }
  }
}`

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    authorization: `bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'AryannGuptaa-profile-contribution-renderer',
  },
  body: JSON.stringify({ query }),
})

if (!response.ok) throw new Error(`GitHub API returned ${response.status}`)
const payload = await response.json()
if (payload.errors) throw new Error(JSON.stringify(payload.errors))

const { login, contributionsCollection } = payload.data.viewer
if (login !== 'AryannGuptaa') throw new Error(`Token belongs to unexpected account: ${login}`)

const calendar = contributionsCollection.contributionCalendar
const weeks = calendar.weeks.slice(-53)
const width = 1160
const height = 220
const cell = 15
const gap = 4
const step = cell + gap
const left = 72
const top = 62
const colors = {
  NONE: '#222520',
  FIRST_QUARTILE: '#365247',
  SECOND_QUARTILE: '#507965',
  THIRD_QUARTILE: '#75a58d',
  FOURTH_QUARTILE: '#a5d1bb',
}

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const months = []
let previousMonth = -1
for (let x = 0; x < weeks.length; x += 1) {
  const firstDay = weeks[x].contributionDays[0]
  const month = new Date(`${firstDay.date}T00:00:00Z`).getUTCMonth()
  if (month !== previousMonth && x > 0) {
    months.push({ x: left + x * step, label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(`${firstDay.date}T00:00:00Z`)) })
  }
  previousMonth = month
}

const cells = weeks.flatMap((week, x) => week.contributionDays.map((day) => {
  const cx = left + x * step
  const cy = top + day.weekday * step
  const title = `${day.contributionCount} contribution${day.contributionCount === 1 ? '' : 's'} on ${day.date}`
  return `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="3" fill="${colors[day.contributionLevel]}"><title>${escapeXml(title)}</title></rect>`
})).join('\n    ')

const monthLabels = months.map(({ x, label }) => `<text x="${x}" y="45">${label}</text>`).join('\n    ')
const generated = new Date().toISOString().slice(0, 10)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">GitHub contribution activity for ${escapeXml(login)}</title>
  <desc id="desc">${calendar.totalContributions} contributions in the last year, including anonymized private activity enabled on the profile.</desc>
  <style>
    text { fill: #8f928b; font: 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .total { fill: #f3f0e8; font-size: 18px; font-weight: 700; letter-spacing: .02em; }
    .meta { font-size: 12px; letter-spacing: .08em; }
  </style>
  <rect width="100%" height="100%" rx="18" fill="#171815" stroke="#3e433c"/>
  <text class="total" x="28" y="31">${calendar.totalContributions.toLocaleString('en-US')} CONTRIBUTIONS · LAST YEAR</text>
  <text class="meta" x="1132" y="31" text-anchor="end">UPDATED ${generated}</text>
  <g aria-hidden="true">
    ${monthLabels}
    <text x="28" y="92">MON</text>
    <text x="28" y="130">WED</text>
    <text x="28" y="168">FRI</text>
    ${cells}
  </g>
</svg>
`

await mkdir('assets', { recursive: true })
await writeFile('assets/github-contributions.svg', svg)
console.log(`Rendered ${calendar.totalContributions} contributions for ${login}`)
