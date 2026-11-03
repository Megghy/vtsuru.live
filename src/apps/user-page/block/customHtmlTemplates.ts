import type { CustomHtmlProps } from './customHtmlContract'

export interface CustomCodeTemplate {
  key: string
  label: string
  html: string
  css: string
  js: string
}
const css =
  'body{padding:24px}main{max-width:900px;margin:auto}button,input{font:inherit;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);color:inherit;background:var(--popover)}button{cursor:pointer}article{padding:16px 0;border-bottom:1px solid var(--border)}small{color:var(--muted-foreground)}img{width:80px;border-radius:50%}nav{display:flex;gap:8px;flex-wrap:wrap}'

export const CUSTOM_CODE_TEMPLATES: CustomCodeTemplate[] = [
  {
    key: 'profile',
    label: '完整个人主页',
    css,
    html: '<main><figure id="profile-face"></figure><h1 id="profile-name">欢迎</h1><p id="profile-bio"></p><p id="profile-live"></p><p id="profile-fans"></p><nav id="profile-nav"></nav></main>',
    js: `const {streamer,bili}=await vtsuru.getContext();
document.querySelector('#profile-name').textContent=streamer.name;
document.querySelector('#profile-bio').textContent=streamer.bio;
if(streamer.faceUrl){const face=document.createElement('img');face.alt='主播头像';face.src=streamer.faceUrl;document.querySelector('#profile-face').append(face)}
document.querySelector('#profile-live').textContent=streamer.isStreaming?'直播中':'休息中';
const fans=bili?.fans??bili?.follower??bili?.follower_count;
document.querySelector('#profile-fans').textContent=fans==null?'':'粉丝 '+fans;
for(const [feature,label,target] of [['songList','歌单','songlist'],['schedule','日程','schedule'],['questionBox','提问箱','question-box'],['checkInRanking','签到榜','check-in-ranking'],['pointGoods','积分兑换','point-goods'],['videoCollect','视频征集','video-collect']]){
 if(!streamer.enabledFeatures.includes(feature))continue;
 const button=document.createElement('button');button.textContent=label;
 button.addEventListener('click',()=>vtsuru.navigate(target));document.querySelector('#profile-nav').append(button);
}`,
  },
  {
    key: 'songs',
    label: '交互式歌单面板',
    css,
    html: '<main><h1>歌单</h1><input id="search" placeholder="搜索歌曲" aria-label="搜索歌曲"><p id="count"></p><section id="songs"></section></main>',
    js: `let sequence=0;
async function render(){const current=++sequence;const {items,total}=await vtsuru.getSongs({keyword:document.querySelector('#search').value,limit:100});if(current!==sequence)return;
document.querySelector('#count').textContent=total+' 首歌曲';document.querySelector('#songs').replaceChildren();
for(const song of items){const row=document.createElement('article');const button=document.createElement('button');button.textContent=song.name+' · '+song.author.join(' / ');button.addEventListener('click',()=>vtsuru.requestSong(song.key));row.append(button);document.querySelector('#songs').append(row)}}
document.querySelector('#search').addEventListener('input',render);await render();`,
  },
  {
    key: 'schedule',
    label: '本周日程时间轴',
    css,
    html: '<main><h1>直播日程</h1><section id="schedule"></section></main>',
    js: `const today=new Date();const thursday=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()));
thursday.setUTCDate(thursday.getUTCDate()+4-(thursday.getUTCDay()||7));
const year=thursday.getUTCFullYear(),week=Math.ceil(((thursday-new Date(Date.UTC(year,0,1)))/86400000+1)/7);
const {weeks,reserves}=await vtsuru.getSchedule({year,week});
for(const week of weeks){const article=document.createElement('article');const title=document.createElement('h2');title.textContent=week.year+' 年 · 第 '+week.week+' 周';article.append(title);
for(const day of week.days.flat()){const p=document.createElement('p');p.textContent=[day.time,day.title,day.tag].filter(Boolean).join(' · ');article.append(p)}document.querySelector('#schedule').append(article)}
for(const reserve of reserves.filter(item=>item.year===year&&item.week===week)){const p=document.createElement('p');p.textContent=reserve.title+' · '+reserve.time;document.querySelector('#schedule').append(p)}
if(!document.querySelector('#schedule').children.length)document.querySelector('#schedule').textContent='本周暂无日程';`,
  },
  {
    key: 'checkin',
    label: '签到榜与提问箱入口',
    css,
    html: '<main><h1>签到榜</h1><ol id="ranking"></ol><button id="question">向我提问</button></main>',
    js: `const {totalRanking}=await vtsuru.getCheckInRanking({count:10});
for(const item of totalRanking){const li=document.createElement('li');li.textContent=item.name+' · '+item.totalCheckInCount;document.querySelector('#ranking').append(li)}
document.querySelector('#question').addEventListener('click',()=>vtsuru.openQuestionBox());`,
  },
]

export function applyCustomCodeTemplate(config: CustomHtmlProps, key: string) {
  const template = CUSTOM_CODE_TEMPLATES.find((item) => item.key === key)
  if (!template) throw new Error('Unknown custom code template')
  return { ...config, html: template.html, css: template.css, js: template.js }
}
