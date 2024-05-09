const x=`
You are a multilinguist expert with expertise in editing and refining text for clarity and conciseness. You excel at rephrasing sentences, paragraphs, and longer texts to improve readability, accuracy without changing the intended meaning and purpose. 
You will maintain the original the original tone and style, will avoid keyword stuffing or over-optimisation and will focus on readability, relevance and proper keyword placement. 
IMPORTANT: You will use the same language of the input text ! Given a text input, analyze its language and respond in that same language. Identify the primary language used in the input and ensure that your reply maintains consistency with this language, regardless of its complexity or rarity. Do not switch languages mid-response or use multiple languages unless the original text does so. This applies to all parts of your response, including any technical or specialized terms.
If needed for creating a better result, You will re-compose and restructure the phrases or will change the order of sentences. 
`;chrome.runtime.onInstalled.addListener(function(){chrome.contextMenus.create({id:"QAIRephraser",title:"Rephrase with AI",contexts:["selection"]})});chrome.contextMenus.onClicked.addListener(function(r,c){if(r.menuItemId=="QAIRephraser"){let t=r.selectionText;chrome.scripting.executeScript({target:{tabId:c.id},func:v,args:[t,x]})}});function v(r,c){const t=document.createElement("div");t.id="QAIModalContainer",t.style.cssText=`
    font-family: system-ui;
    font-weight: 300;
    line-height: 1.5em;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10000;
    background-color: rgba(0, 0, 0, 0.5); 
    display: flex;
    justify-content: center;
    align-items: center;
  `;const a=document.createElement("div");a.id="QAIModalContent",a.style.cssText=`
    padding: 0.8em;
    width: 55vw;
    height: auto;
    font-size: 17px;
    background-color: #0e131e;
    color: #eee;
    overflow-y: auto; 
    box-sizing: border-box;
    position: relative;
  `;const l=document.createElement("button");l.innerText="x",l.style.cssText=`
    position: absolute;
    top: 7px;
    right: 7px;
    background-color: transparent;
    border: none;
    color: white;
    font-size: 15px;
    cursor: pointer;
  `,l.onclick=function(){t.remove()};const n=document.createElement("div");n.style.cssText=`
    padding: 0.8em;
  `,n.ondblclick=()=>{n.innerText="Waiting for AI...",port.postMessage({content:r})},n.onclick=()=>p();function p(){let e=n.innerText;(async()=>await navigator.clipboard.writeText(e))()}n.innerHTML="Waiting for AI...",a.appendChild(n),t.appendChild(a),document.body.appendChild(t);function u(e){e.key==="Escape"&&m()}function h(e){a.contains(e.target)||m()}window.addEventListener("keydown",u),t.addEventListener("click",h);function m(){p(),t.remove(),window.removeEventListener("keydown",u),window.removeEventListener("click",h)}function g(e){return new Promise((o,s)=>{chrome.storage.sync.get(e,i=>{if(chrome.runtime.lastError)return s(chrome.runtime.lastError);o(i)})})}async function y(e,o){let{openaiApiKey:s,model:i}=await g(["openaiApiKey","model"]);i=i||"gpt-3.5-turbo",console.log("Model: ",i,"API Key: ",s);const f="https://api.openai.com/v1/chat/completions",w={prompt:e,temperature:Math.random()*2*.1+.5};if(!s){alert("Please set your API Key in the options page.");return}const d=await fetch(f,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s}`},body:JSON.stringify({model:i,messages:[{role:"system",content:o+" You will deliver the output in JSON."},{role:"user",content:e}],response_format:{type:"json_object"},temperature:w.temperature})});if(!d.ok)throw new Error("Failed to fetch from OpenAI: "+d.statusText);return d.json()}y("Rephrase this text: "+r,c).then(e=>{const o=JSON.parse(e.choices[0].message.content);n.innerHTML=o[Object.keys(o)[0]]}).catch(e=>console.error("Error with OpenAI API:",e))}
