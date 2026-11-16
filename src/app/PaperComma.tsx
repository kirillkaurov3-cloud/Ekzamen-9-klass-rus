import {useId} from 'react';
/** Folded ribbon mark. Static SVG also serves as the reduced-motion fallback. */
export default function PaperComma(){
 const id=useId().replaceAll(':',''),face=`${id}-face`,edge=`${id}-edge`,fold=`${id}-fold`,light=`${id}-light`;
 return <svg className="paper-comma" viewBox="0 0 280 330" fill="none" aria-hidden="true"><defs>
  <linearGradient id={face} x1="78" y1="36" x2="208" y2="193" gradientUnits="userSpaceOnUse"><stop stopColor="#f0ffd6"/><stop offset=".35" stopColor="#d6ff91"/><stop offset=".7" stopColor="#b4ed61"/><stop offset="1" stopColor="#8ec246"/></linearGradient>
  <linearGradient id={edge} x1="103" y1="213" x2="218" y2="109" gradientUnits="userSpaceOnUse"><stop stopColor="#749b3c"/><stop offset=".55" stopColor="#b4e66b"/><stop offset="1" stopColor="#e4ffb7"/></linearGradient>
  <linearGradient id={fold} x1="97" y1="185" x2="186" y2="280" gradientUnits="userSpaceOnUse"><stop stopColor="#729c34"/><stop offset=".25" stopColor="#b0dd66"/><stop offset=".65" stopColor="#dcffa3"/><stop offset="1" stopColor="#f0ffd6"/></linearGradient>
  <linearGradient id={light} x1="76" y1="50" x2="156" y2="157" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity=".8"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
 </defs>
 <ellipse cx="143" cy="291" rx="69" ry="13" fill="#1b125f" opacity=".2"/>
 <g className="comma-ribbon">
  <path d="M165 53C215 59 242 104 222 159C207 211 165 254 103 281L85 256C131 229 145 210 142 188C102 198 67 178 57 147C38 88 101 41 165 53Z" fill="#372586" opacity=".35" transform="translate(7 9)"/>
  <path d="M158 43C213 46 238 94 219 151C207 190 179 220 152 239L119 213C147 184 158 153 152 122L158 43Z" fill={`url(#${edge})`}/>
  <path d="M119 153C145 163 177 156 196 137C201 193 155 245 94 270L77 245C119 221 137 196 128 176L119 153Z" fill={`url(#${fold})`}/>
  <path d="M158 43C204 48 228 82 216 120C205 155 164 177 123 170C87 166 60 144 59 113C57 69 109 36 158 43Z" fill={`url(#${face})`}/>
  <path d="M158 43C109 36 57 69 59 113C60 144 87 166 123 170" stroke={`url(#${light})`} strokeWidth="3"/>
  <path d="M196 137C179 157 151 167 128 164" stroke="#eeffce" strokeOpacity=".8" strokeWidth="2"/>
  <path d="M85 247C109 235 130 217 139 203" stroke="#f2ffdb" strokeOpacity=".65" strokeWidth="2"/>
 </g></svg>;
}
