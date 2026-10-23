import{D as e,_ as t,a as n,c as r,d as i,f as a,g as o,h as s,i as c,l,m as u,o as d,p as f,r as p,s as m,u as h,v as g,w as _,y as v}from"./index-9VgRAaml.js";import{A as y,D as b,E as x,M as S,N as C,P as w,S as T,a as E,b as D,c as O,d as k,f as A,g as j,h as M,i as N,j as ee,k as P,l as F,m as I,o as L,p as R,s as z,t as te,u as ne,v as re,y as ie}from"./AssetModel-CM9yL_TF.js";import{n as ae,t as oe}from"./OrbitControls-6vHslyDU.js";var se=N>=125?`uv1`:`uv2`,ce=new F,le=new S,ue=class extends R{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new A([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new A([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new I(t,6,1);return this.setAttribute(`instanceStart`,new M(n,3,0)),this.setAttribute(`instanceEnd`,new M(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new I(n,t*2,1);return this.setAttribute(`instanceColorStart`,new M(r,t,0)),this.setAttribute(`instanceColorEnd`,new M(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new w(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new F);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),ce.setFromBufferAttribute(t),this.boundingBox.union(ce))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new b),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)le.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(le)),le.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(le));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},de=class extends ue{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},fe=class extends x{constructor(e){super({type:`LineMaterial`,uniforms:y.clone(y.merge([O.common,O.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new ee(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${N>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},pe=new C,me=new S,he=new S,B=new C,V=new C,H=new C,ge=new S,_e=new ie,U=new j,ve=new S,ye=new F,be=new b,W=new C,G,xe;function Se(e,t,n){return W.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),W.multiplyScalar(1/W.w),W.x=xe/n.width,W.y=xe/n.height,W.applyMatrix4(e.projectionMatrixInverse),W.multiplyScalar(1/W.w),Math.abs(Math.max(W.x,W.y))}function Ce(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){U.start.fromBufferAttribute(i,r),U.end.fromBufferAttribute(a,r),U.applyMatrix4(n);let o=new S,s=new S;G.distanceSqToSegment(U.start,U.end,s,o),s.distanceTo(o)<xe*.5&&t.push({point:s,pointOnLine:o,distance:G.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[se]:null})}}function we(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;G.at(1,H),H.w=1,H.applyMatrix4(t.matrixWorldInverse),H.applyMatrix4(r),H.multiplyScalar(1/H.w),H.x*=i.x/2,H.y*=i.y/2,H.z=0,ge.copy(H),_e.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(B.fromBufferAttribute(s,t),V.fromBufferAttribute(c,t),B.w=1,V.w=1,B.applyMatrix4(_e),V.applyMatrix4(_e),B.z>u&&V.z>u)continue;if(B.z>u){let e=B.z-V.z,t=(B.z-u)/e;B.lerp(V,t)}else if(V.z>u){let e=V.z-B.z,t=(V.z-u)/e;V.lerp(B,t)}B.applyMatrix4(r),V.applyMatrix4(r),B.multiplyScalar(1/B.w),V.multiplyScalar(1/V.w),B.x*=i.x/2,B.y*=i.y/2,V.x*=i.x/2,V.y*=i.y/2,U.start.copy(B),U.start.z=0,U.end.copy(V),U.end.z=0;let o=U.closestPointToPointParameter(ge,!0);U.at(o,ve);let l=re.lerp(B.z,V.z,o),d=l>=-1&&l<=1,f=ge.distanceTo(ve)<xe*.5;if(d&&f){U.start.fromBufferAttribute(s,t),U.end.fromBufferAttribute(c,t),U.start.applyMatrix4(a),U.end.applyMatrix4(a);let r=new S,i=new S;G.distanceSqToSegment(U.start,U.end,i,r),n.push({point:i,pointOnLine:r,distance:G.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[se]:null})}}}var Te=class extends D{constructor(e=new ue,t=new fe({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)me.fromBufferAttribute(t,e),he.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+me.distanceTo(he);let i=new I(r,2,1);return e.setAttribute(`instanceDistanceStart`,new M(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new M(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;G=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;xe=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),be.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?xe*.5:Se(r,Math.max(r.near,be.distanceToPoint(G.origin)),s.resolution),be.radius+=c,G.intersectsSphere(be)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),ye.copy(o.boundingBox).applyMatrix4(a);let l;l=n?xe*.5:Se(r,Math.max(r.near,ye.distanceToPoint(G.origin)),s.resolution),ye.expandByScalar(l),G.intersectsBox(ye)!==!1&&(n?Ce(this,t):we(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(pe),this.material.uniforms.resolution.value.set(pe.z,pe.w))}},Ee=class extends Te{constructor(e=new de,t=new fe({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},K=e(_()),De=K.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:i,segments:a,dashed:o,...s},c){var l;let u=z(e=>e.size),d=K.useMemo(()=>a?new Te:new Ee,[a]),[f]=K.useState(()=>new fe),p=(n==null||(l=n[0])==null?void 0:l.length)===4?4:3,m=K.useMemo(()=>{let r=a?new ue:new de,i=e.map(e=>{let t=Array.isArray(e);return e instanceof S||e instanceof C?[e.x,e.y,e.z]:e instanceof ee?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof k?e.toArray():e);r.setColors(e.flat(),p)}return r},[e,a,n,p]);return K.useLayoutEffect(()=>{d.computeLineDistances()},[e,d]),K.useLayoutEffect(()=>{o?f.defines.USE_DASH=``:delete f.defines.USE_DASH,f.needsUpdate=!0},[o,f]),K.useEffect(()=>()=>{m.dispose(),f.dispose()},[m]),K.createElement(`primitive`,ae({object:d,ref:c},s),K.createElement(`primitive`,{object:m,attach:`geometry`}),K.createElement(`primitive`,ae({object:f,attach:`material`,color:t,vertexColors:!!n,resolution:[u.width,u.height],linewidth:r??i??1,dashed:o,transparent:p===4},s)))}),Oe=`dreammate.universe-layout.v2`;function ke(e,t,n,r,i=[]){let a=new Map,o=[...i],s=[0,-62,62,-124,124,-186,186,-248,248,-310,310].flatMap(e=>[0,-160,160,-320,320,-480,480].map(t=>({dx:t,dy:e}))).sort((e,t)=>e.dx**2+e.dy**2-t.dx**2-t.dy**2);for(let i of[...e].sort((e,t)=>e.priority-t.priority||e.y-t.y||e.id.localeCompare(t.id))){let e=!1;for(let c of s){let s=Math.max(i.width/2+15,Math.min(n-i.width/2-15,i.x+c.dx)),l=i.y+c.dy;if(l<i.height+45||l>r-65)continue;let u={left:s-i.width/2-6,right:s+i.width/2+6,top:l-i.height-6,bottom:l-17+6};if(!o.some(e=>u.left<e.right&&u.right>e.left&&u.top<e.bottom&&u.bottom>e.top)&&!t.some(e=>u.left<e.x+e.radius&&u.right>e.x-e.radius&&u.top<e.y+e.radius&&u.bottom>e.y-e.radius)){o.push(u),a.set(i.id,{x:s,y:l,visible:!0}),e=!0;break}}e||a.set(i.id,{x:i.x,y:i.y,visible:!1})}return a}function Ae(e){return Number.isSafeInteger(e)&&e>0?16/(2*Math.PI)*e:0}function je(e,t=[],r){let i=[...new Set(e)],a=new Map,o=new Set;for(let e of t)!e||typeof e.id!=`string`||a.has(e.id)||!Number.isSafeInteger(e.slot)||e.slot<0||e.slot>1e5||o.has(e.slot)||(a.set(e.id,e.slot),o.add(e.slot));let s=i.filter(e=>!a.has(e)).sort((e,t)=>n(e)-n(t)||e.localeCompare(t)),c=0;for(let e of a.values())c=Math.max(c,e+1);for(let e of s){for(c>1e5&&(c=0);o.has(c);)c+=1;a.set(e,c),o.add(c),c+=1}let l=new Map,u=i.filter(e=>e!==r),d=Ae(u.length);return i.sort((e,t)=>a.get(e)-a.get(t)),u.sort((e,t)=>a.get(e)-a.get(t)),u.forEach((e,t)=>{let n=t/u.length*Math.PI*2+Math.PI/12;l.set(e,{id:e,slot:a.get(e),orbitRadius:d,x:Math.cos(n)*d,y:.3,z:Math.sin(n)*d})}),r&&i.includes(r)&&l.set(r,{id:r,slot:a.get(r),x:0,y:.3,z:0,orbitRadius:0,role:`relay-center`}),{assignments:[...a].map(([e,t])=>({id:e,slot:t})),plots:l,rings:u.length?[d]:[],radius:d}}function Me(e){let t=[...new Set(e)].sort();return t.flatMap((e,n)=>t.slice(n+1).map(t=>({from:e,to:t})))}function Ne(e,t){return i(e.nodes.find(e=>e.id===t))}var q=Math.PI*2,Pe=e=>e*Math.PI/180,J=(e,t=0)=>Number.isFinite(e)?e:t;function Y(e,t){let r=n(`${t}:${e}`);return r=Math.imul(r^r>>>16,2146121005),r=Math.imul(r^r>>>15,2221713035),((r^r>>>16)>>>0)/4294967296}function Fe(e,t=.94){return{inclination:Pe(18+Y(e,`inclination`)*25),longitude:Y(e,`longitude`)*q,aspect:t}}function Ie(e,t,n){let r=Math.max(0,J(e)),i=J(t)%q,a=Math.max(.8,Math.min(1,J(n.aspect,.94))),o=Math.max(-Math.PI/3,Math.min(Math.PI/3,J(n.inclination))),s=J(n.longitude)%q,c=r*Math.cos(i),l=r*a*Math.sin(i);return[c,(l*Math.cos(s)-c*Math.sin(s))*Math.tan(o),l]}function Le(e,t){let n=Math.max(-Math.PI/3,Math.min(Math.PI/3,J(t.inclination)));return Math.max(0,J(e))/Math.cos(n)}function Re(e,t,n=160){return Array.from({length:n+1},(r,i)=>Ie(e,i/n*q,t))}function ze(e){let t=Pe(22+Y(e,`spin-tilt`)*57),n=Y(e,`spin-yaw`)*q;return{axis:[Math.sin(t)*Math.cos(n),Math.cos(t),Math.sin(t)*Math.sin(n)],phase:Y(e,`spin-phase`)*q,speed:(.045+Y(e,`spin-speed`)*.075)*(Y(e,`spin-direction`)<.22?-1:1)}}function Be(e,t){let n=J(t)%(q/Math.abs(e.speed)),r=(e.phase+n*e.speed)/2,i=Math.sin(r);return[e.axis[0]*i,e.axis[1]*i,e.axis[2]*i,Math.cos(r)]}function Ve(e){return{rotation:[Pe(18+Y(e,`ring-tilt`)*48),Y(e,`ring-yaw`)*q,(Y(e,`ring-roll`)-.5)*.6],speed:.022+Y(e,`ring-speed`)*.03,phase:Y(e,`ring-phase`)*q}}function He(e,t,r,i=[]){let a=new Set(e.nodes.map(e=>e.id)),o=new Set,s=new Map(e.nodes.map(t=>[t.id,Ne(e,t.id)])),c=t.flatMap(e=>{if(!a.has(e.centerNodeId)||o.has(e.centerNodeId))return[];let t=[...new Set(e.nodeIds)].filter(t=>a.has(t)&&!o.has(t)&&(t!==r||t===e.centerNodeId));t.includes(e.centerNodeId)||t.unshift(e.centerNodeId),t.forEach(e=>o.add(e));let i=t.filter(t=>t!==e.centerNodeId),c=s.get(e.centerNodeId),l=Math.max(0,...i.map(e=>s.get(e))),u=Fe(`local:${e.id}`,.9+Y(e.id,`local-aspect`)*.08),d=i.length?Math.max(Ae(i.length),12,(c+l)*1.9+4)/u.aspect:0,f=[...i].sort((e,t)=>n(e)-n(t)||e.localeCompare(t));for(let e=0;e<f.length;e++)for(let t=e+1;t<f.length;t++){let n=Math.min(t-e,f.length-(t-e))*Math.PI*2/f.length;d=Math.max(d,((s.get(f[e])+s.get(f[t]))*1.9+2)/(2*u.aspect*Math.sin(n/2)))}let p=Math.max(0,...i.map(e=>Le(d,Fe(`planet:${e}`,u.aspect)))),m=Math.max(c*1.9+2,p+l*1.9+2);return[{...e,nodeIds:t,majorRadius:0,majorPhase:0,minorRadius:d,minorInclination:u.inclination,majorPlane:Fe(`galactic:${e.id}`),minorPlane:u,minorSpeed:.035*(.85+Y(e.id,`local-speed`)*.3),envelope:m,maxPlanetRadius:Math.max(c,l)}]});for(let e of a)if(!o.has(e)&&e!==r){let t=s.get(e);c.push({id:`system:remote:${e}`,kind:`remote`,centerNodeId:e,authority:``,nodeIds:[e],status:`unknown`,majorRadius:0,majorPhase:0,minorRadius:0,minorInclination:0,envelope:t*1.9+2,maxPlanetRadius:t,majorPlane:Fe(`galactic:system:remote:${e}`),minorPlane:Fe(`local:${e}`),minorSpeed:.035})}let l=c.filter(e=>e.centerNodeId!==r),u=je(l.map(e=>e.id),i);l.sort((e,t)=>u.plots.get(e.id).slot-u.plots.get(t.id).slot);let d=c.find(e=>e.centerNodeId===r)?.envelope??(r&&s.has(r)?s.get(r)*1.9+2:0),f=Math.max(0,...l.map(e=>e.envelope)),p=.94,m=l.length?(d+f+10)/p:0;if(l.length>1)for(let e=0;e<l.length;e++)for(let t=e+1;t<l.length;t++){let n=Math.min(t-e,l.length-(t-e))*Math.PI*2/l.length;m=Math.max(m,(l[e].envelope+l[t].envelope+8)/(2*p*Math.sin(n/2)))}l.forEach((e,t)=>{e.majorRadius=m,e.majorPhase=t/l.length*Math.PI*2+Math.PI/12});let h=new Map;for(let e of c){let t=e.nodeIds.filter(t=>t!==e.centerNodeId).sort((e,t)=>n(e)-n(t)||e.localeCompare(t));for(let n of e.nodeIds){let i=t.indexOf(n),a=i<0?0:i/t.length*Math.PI*2+Y(e.id,`local-phase`)*Math.PI*2,o={systemId:e.id,majorRadius:e.majorRadius,majorPhase:e.majorPhase,minorRadius:i<0?0:e.minorRadius,minorPhase:a,minorInclination:e.minorInclination,majorPlane:e.majorPlane,minorPlane:Fe(`planet:${n}`,e.minorPlane.aspect),minorSpeed:e.minorSpeed};h.set(n,{id:n,slot:Math.max(0,i),x:0,y:.3,z:0,orbitRadius:o.minorRadius,role:n===r?`relay-center`:n===e.centerNodeId?e.kind===`entry`?`service-center`:`system-center`:void 0,galaxy:o})}}return r&&a.has(r)&&!h.has(r)&&h.set(r,{id:r,slot:0,x:0,y:.3,z:0,orbitRadius:0,role:`relay-center`}),{assignments:u.assignments,plots:h,rings:m?[m]:[],radius:Math.max(d,...c.map(e=>Le(e.majorRadius,e.majorPlane)+e.envelope)),systems:c,majorRadius:m,localSystemId:c.find(e=>e.kind===`entry`)?.id}}var Ue=Math.PI*2,We=.3,Ge=.1,X=(e,t)=>Number.isFinite(e)?e:t;function Ke(){return 8*Math.PI/180}function qe(){return .02}var Je=.006,Ye=.035;function Xe(e,t){let n=X(t,0)%(Ue/Je),r=X(e.majorPhase,0)+n*Je;if(!e.majorPlane)return Qe(e.majorRadius,r);let i=Ie(e.majorRadius,r,e.majorPlane);return[i[0],We+i[1],i[2]]}function Ze(e,t,n){let r=Number.isFinite(e)&&e>0?e:0,i=X(t,0)%Ue,a=X(n,0);return[r*Math.cos(i),r*Math.sin(i)*Math.sin(a),r*Math.sin(i)*Math.cos(a)]}function Qe(e,t){let n=Number.isFinite(e)&&e>0?e:0,r=X(t,0)%Ue,i=Ke(),a=n*Math.sin(r);return[n*Math.cos(r),We+a*Math.sin(i),a*Math.cos(i)]}function $e(e,t){if(e.role===`relay-center`)return[0,We,0];if(e.galaxy){let n=e.galaxy,r=Xe(n,t),i=Number.isFinite(n.minorSpeed)&&n.minorSpeed>0?n.minorSpeed:Ye,a=X(t,0)%(Ue/i),o=X(n.minorPhase,0)+a*i,s=n.minorPlane?Ie(n.minorRadius,o,n.minorPlane):Ze(n.minorRadius,o,n.minorInclination);return r.map((e,t)=>e+s[t])}let n=X(e.x,0),r=X(e.z,0),i=Math.hypot(n,r),a=Number.isFinite(e.orbitRadius)&&e.orbitRadius>0?e.orbitRadius:Number.isFinite(i)?i:0,o=qe(),s=X(t,0)%(Ue/o);return Qe(a,Math.atan2(r,n)+s*o)}function et(e,t,n){let r=Number.isFinite(e)&&e>=0?e:0;return!n||!Number.isFinite(t)||t<=0?r:r+Math.min(t,Ge)}var Z=g();function tt({radius:e,plane:t,major:n=!1,emphasized:r=!1}){let i=(0,K.useMemo)(()=>Re(e,t),[e,t.inclination,t.longitude,t.aspect]);return(0,Z.jsx)(De,{points:i,color:n?`#728ca2`:`#6ee5ef`,lineWidth:n?.7:.85,transparent:!0,opacity:n?r?.28:.14:.28,dashed:n,dashSize:.5,gapSize:.5,raycast:()=>{}})}function nt({system:e,layout:t,positions:n}){let r=(0,K.useRef)(null);return L(()=>{let t=n.current.get(e.centerNodeId);t&&r.current&&r.current.position.copy(t)}),(0,Z.jsx)(`group`,{ref:r,children:e.nodeIds.map(e=>{let n=t.plots.get(e)?.galaxy;return n&&n.minorRadius>0&&n.minorPlane?(0,Z.jsx)(tt,{radius:n.minorRadius,plane:n.minorPlane},e):null})})}function rt({layout:e,positions:t}){return(0,Z.jsxs)(`group`,{children:[(0,Z.jsx)(`group`,{position:[0,We,0],children:e.systems.filter(e=>e.majorRadius>0).map(e=>(0,Z.jsx)(tt,{radius:e.majorRadius,plane:e.majorPlane,major:!0,emphasized:e.kind===`entry`},e.id))}),e.systems.filter(e=>e.minorRadius>0).map(n=>(0,Z.jsx)(nt,{system:n,layout:e,positions:t},n.id))]})}function it({radius:e,time:t,color:n=`#efbd70`}){let r=(0,K.useRef)(null);return L(()=>{r.current&&(r.current.rotation.y=t.current*.08)}),(0,Z.jsxs)(`group`,{ref:r,children:[[1.5,1.9].map((t,r)=>(0,Z.jsxs)(`mesh`,{rotation:[-Math.PI/2+r*.3,r*.4,0],raycast:()=>{},children:[(0,Z.jsx)(`torusGeometry`,{args:[e*t,e*.018,6,96]}),(0,Z.jsx)(`meshBasicMaterial`,{color:n,transparent:!0,opacity:r?.38:.8,depthWrite:!1,toneMapped:!1})]},t)),(0,Z.jsxs)(`mesh`,{position:[0,e*1.85,0],raycast:()=>{},children:[(0,Z.jsx)(`cylinderGeometry`,{args:[e*.012,e*.012,e*1.4,6]}),(0,Z.jsx)(`meshBasicMaterial`,{color:n,transparent:!0,opacity:.7,depthWrite:!1,toneMapped:!1})]}),(0,Z.jsxs)(`mesh`,{position:[0,e*2.65,0],rotation:[0,0,Math.PI/4],raycast:()=>{},children:[(0,Z.jsx)(`octahedronGeometry`,{args:[e*.11]}),(0,Z.jsx)(`meshBasicMaterial`,{color:n,toneMapped:!1})]})]})}function at(e){return typeof e.networkOnline==`boolean`?e.networkOnline:e.online===!0&&e.status!==`stale`&&e.status!==`offline`}var ot=new b,st=new S,ct=new S,lt=function(e,t){for(let e=this;e;e=e.parent)if(!e.visible)return;let n=this.geometry.getAttribute(`position`);if(!n?.count)return;let r=this.matrixWorld.getMaxScaleOnAxis()*.065;if(this.geometry.computeBoundingSphere(),ot.copy(this.geometry.boundingSphere).applyMatrix4(this.matrixWorld),ot.radius+=r,!e.ray.intersectsSphere(ot))return;let i,a=r*r;for(let t=0;t<n.count;t++){st.fromBufferAttribute(n,t).applyMatrix4(this.matrixWorld);let r=e.ray.distanceSqToPoint(st);if(r>a)continue;e.ray.closestPointToPoint(st,ct);let o=e.ray.origin.distanceTo(ct);o<e.near||o>e.far||r===a&&i&&o>=i.distance||(a=r,i={distance:o,distanceToRay:Math.sqrt(r),point:ct.clone(),index:t,object:this})}i&&t.push(i)},ut=Math.PI*2,dt=e=>n(e)/4294967295;function ft({service:e,angle:t,selected:n,gestureMoved:r,onSelect:i,onHover:a,illuminated:o}){let[s,c]=(0,K.useState)(!1),l=o?n||s?`#dbfaff`:e.status===`up`?`#7cdef1`:`#8794a4`:`#303b48`,u=t=>{r.current&&t.buttons||(t.stopPropagation(),c(!0),a({type:`service`,service:e,clientX:t.clientX,clientY:t.clientY}))};return(0,Z.jsxs)(`group`,{position:[Math.cos(t)*1.72,.045,Math.sin(t)*1.72],rotation:[0,-t,0],onPointerOver:u,onPointerMove:u,onPointerOut:()=>{c(!1),a(null)},onClick:t=>{t.stopPropagation(),t.delta<=6&&!r.current&&i({type:`service`,id:e.id})},children:[(0,Z.jsxs)(`mesh`,{children:[(0,Z.jsx)(`octahedronGeometry`,{args:[.084,0]}),(0,Z.jsx)(`meshStandardMaterial`,{color:l,emissive:l,emissiveIntensity:o?n||s?1.1:.5:0,metalness:.5,roughness:.3})]}),[-1,1].map(e=>(0,Z.jsxs)(`mesh`,{position:[0,0,e*.105],children:[(0,Z.jsx)(`boxGeometry`,{args:[.1,.016,.14]}),(0,Z.jsx)(`meshStandardMaterial`,{color:l,emissive:l,emissiveIntensity:o?.22:0,metalness:.65,roughness:.35})]},e)),(0,Z.jsxs)(`mesh`,{children:[(0,Z.jsx)(`sphereGeometry`,{args:[.17,8,6]}),(0,Z.jsx)(`meshBasicMaterial`,{transparent:!0,opacity:0,depthWrite:!1})]})]})}function pt({contents:e,radius:t,seed:n,time:r,selectedServiceId:i,selectedSkillId:a,gestureMoved:o,onSelect:s,onHover:c,illuminated:l=!0}){let u=(0,K.useRef)(null),[d,f]=(0,K.useState)(),p=(0,K.useMemo)(()=>Ve(n),[n]),m=p.phase,h=(0,K.useMemo)(()=>{let t=new Float32Array(e.skills.length*3);return e.skills.forEach((e,r)=>{let i=dt(`skill-angle:${n}:${e.id}`)*ut,a=1.14+dt(`skill-radius:${n}:${e.id}`)*.39;t.set([Math.cos(i)*a,(dt(`skill-height:${n}:${e.id}`)-.5)*.05,Math.sin(i)*a],r*3)}),t},[e.skills,n]),g=(0,K.useMemo)(()=>{let t=new Float32Array(e.skills.length*3);return e.skills.forEach((e,n)=>{let r=e.id===d||e.id===a,i=new k(r?`#fff2cf`:l?e.cached?`#7f8997`:`#ffda96`:`#303b48`);t.set([i.r,i.g,i.b],n*3)}),t},[e.skills,l,d,a]),_=(0,K.useMemo)(()=>new Float32Array(e.skills.flatMap((e,t)=>e.id===d||e.id===a?Array.from(h.subarray(t*3,t*3+3)):[])),[e.skills,h,d,a]),v=t=>{if(t.stopPropagation(),o.current&&t.buttons)return;let n=t.index===void 0?void 0:e.skills[t.index];n&&(f(n.id),c({type:`skill`,skill:n,clientX:t.clientX,clientY:t.clientY}))};L(()=>{u.current&&(u.current.rotation.y=m-r.current*p.speed)});let y=l?e.catalogKnown?`#81b6c5`:`#8c939f`:`#263341`;return(0,Z.jsx)(`group`,{rotation:p.rotation,scale:t,children:(0,Z.jsxs)(`group`,{ref:u,rotation:[0,m,0],children:[(0,Z.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],raycast:()=>{},children:[(0,Z.jsx)(`torusGeometry`,{args:[1.72,.0045,4,192]}),(0,Z.jsx)(`meshBasicMaterial`,{color:y,transparent:!0,opacity:l?.34:.16,depthWrite:!1,toneMapped:!1})]}),e.skills.length>0&&(0,Z.jsxs)(`points`,{raycast:lt,onPointerOver:v,onPointerMove:v,onPointerOut:()=>{f(void 0),c(null)},onClick:t=>{t.stopPropagation();let n=t.index===void 0?void 0:e.skills[t.index];n&&t.delta<=6&&!o.current&&s({type:`skill`,id:n.id,serviceId:n.serviceId})},children:[(0,Z.jsxs)(`bufferGeometry`,{children:[(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[h,3]}),(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-color`,args:[g,3]})]},h.length),(0,Z.jsx)(`pointsMaterial`,{vertexColors:!0,size:t*.038,transparent:!0,opacity:l?.96:.2,blending:2,depthWrite:!1,toneMapped:!1})]}),_.length>0&&(0,Z.jsxs)(`points`,{raycast:()=>{},children:[(0,Z.jsx)(`bufferGeometry`,{children:(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[_,3]})}),(0,Z.jsx)(`pointsMaterial`,{color:`#fff2cf`,size:t*.095,transparent:!0,opacity:.96,blending:2,depthWrite:!1,toneMapped:!1})]}),e.services.map((t,n)=>(0,Z.jsx)(ft,{service:t,angle:n/e.services.length*ut,selected:i===t.id,gestureMoved:o,onSelect:s,onHover:c,illuminated:l},t.id))]})})}function mt({composition:e,illuminated:t=!0}){let n=0;return(0,Z.jsxs)(`group`,{raycast:()=>{},children:[(0,Z.jsxs)(`mesh`,{children:[(0,Z.jsx)(`sphereGeometry`,{args:[.998,64,40]}),(0,Z.jsx)(`meshBasicMaterial`,{color:t?d.unknown:`#1b232d`,transparent:!0,opacity:.12,depthWrite:!1})]}),e.segments.flatMap(e=>{if(e.share===null||e.share<=0)return[];let r=n;return n+=e.share*ut,(0,Z.jsxs)(`mesh`,{children:[(0,Z.jsx)(`sphereGeometry`,{args:[1.027,Math.max(2,Math.ceil(e.share*192)),48,r,e.share*ut]}),(0,Z.jsx)(`meshBasicMaterial`,{color:t?d[e.category]:new k(d[e.category]).multiplyScalar(.12),transparent:!0,opacity:.74,depthWrite:!1,side:2,toneMapped:!1})]},e.category)})]})}var ht={cyan:`#62efff`,ice:`#bcecff`,amber:`#ffbc67`,violet:`#8d74e6`,background:`#020813`,orbitOpacity:.33};function gt(e){let t=n(e);return t=Math.imul(t^t>>>16,2146121005),t=Math.imul(t^t>>>15,2221713035),((t^t>>>16)>>>0)/4294967295}function _t(e,t=0){let n=(0,K.useRef)(t);return L((t,r)=>{e&&(n.current+=Math.min(r,.05))}),n}var vt=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,yt=`
  varying vec2 vUv; uniform float time;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
  float cloud(vec2 p){return noise(p)*.57+noise(p*2.13)*.28+noise(p*4.27)*.15;}
  void main(){
    vec2 uv=(vUv-.5)*vec2(1.7,1.0); vec2 p=uv*5.0+vec2(time*.004,0.);
    float dust=cloud(p+cloud(p*1.5));
    float ribbon=exp(-pow((uv.y+uv.x*.22+.10*sin(uv.x*6.0))*3.1,2.0));
    float edge=1.0-smoothstep(.18,.82,length(uv));
    vec3 color=mix(vec3(.015,.15,.24),vec3(.13,.055,.25),smoothstep(-.5,.7,uv.x));
    color+=vec3(.025,.15,.20)*exp(-length(uv-vec2(-.30,.09))*4.0);
    color+=vec3(.19,.07,.012)*exp(-length(uv-vec2(.12,-.04))*7.0);
    gl_FragColor=vec4(color,(.24+dust*.8)*ribbon*edge*.58);
  }
`;function bt({animate:e}){let t=(0,K.useRef)(null),n=(0,K.useRef)(null),{camera:r,size:i}=z(),a=(0,K.useMemo)(()=>new S,[]),o=_t(e),s=(0,K.useMemo)(()=>({time:{value:0}}),[]);return L(()=>{if(t.current&&(r.getWorldDirection(a),t.current.position.copy(r.position).addScaledVector(a,150),t.current.quaternion.copy(r.quaternion),r instanceof T&&i.height>0)){let e=300*Math.tan(r.fov*Math.PI/360)/r.zoom;t.current.scale.set(e*i.width/i.height/125*1.2,e/82*1.2,1)}n.current&&(n.current.uniforms.time.value=o.current)}),(0,Z.jsx)(`group`,{ref:t,renderOrder:-100,children:(0,Z.jsxs)(`mesh`,{raycast:()=>{},children:[(0,Z.jsx)(`planeGeometry`,{args:[125,82]}),(0,Z.jsx)(`shaderMaterial`,{ref:n,uniforms:s,vertexShader:vt,fragmentShader:yt,transparent:!0,blending:2,depthWrite:!1})]})})}function xt({animate:e}){let t=(0,K.useRef)(null),n=_t(e,.6),r=(0,K.useMemo)(()=>[3200,180].map((e,t)=>{let n=new Float32Array(e*3);for(let r=0;r<e;r+=1){let e=`stellar-${t}-${r}`,i=gt(`height:${e}`)*2-1,a=gt(`azimuth:${e}`)*Math.PI*2,o=6500+gt(`depth:${e}`)*2500,s=Math.sqrt(Math.max(0,1-i*i));n[r*3]=o*s*Math.cos(a),n[r*3+1]=o*i,n[r*3+2]=o*s*Math.sin(a)}return n}),[]);return L(()=>{t.current&&(t.current.opacity=.67+Math.sin(n.current*.32)*.12)}),(0,Z.jsxs)(`group`,{children:[(0,Z.jsxs)(`points`,{raycast:()=>{},children:[(0,Z.jsx)(`bufferGeometry`,{children:(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[r[0],3]})}),(0,Z.jsx)(`pointsMaterial`,{color:`#8eaccd`,size:1.15,sizeAttenuation:!1,transparent:!0,opacity:.7,depthWrite:!1})]}),(0,Z.jsxs)(`points`,{raycast:()=>{},children:[(0,Z.jsx)(`bufferGeometry`,{children:(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[r[1],3]})}),(0,Z.jsx)(`pointsMaterial`,{ref:t,color:`#c4efff`,size:2.25,sizeAttenuation:!1,transparent:!0,opacity:.74,depthWrite:!1,blending:2})]})]})}var St=`varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,Ct=`uniform vec3 tint;uniform float strength;varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.7);gl_FragColor=vec4(tint,rim*strength);}`,wt=`varying vec2 vUv;uniform vec3 tint;uniform float strength;void main(){vec2 p=vUv-.5;float r=length(p);float halo=exp(-r*18.)*.72+exp(-r*r*60.)*.14;float flare=exp(-abs(p.y)*280.)*exp(-abs(p.x)*10.)*.22;vec3 color=mix(tint,vec3(1.,.96,.81),exp(-r*48.));gl_FragColor=vec4(color,(halo+flare)*strength*(1.-smoothstep(.35,.5,r)));}`;function Tt({radius:e,core:t,color:n,selected:r,animate:i}){let a=(0,K.useRef)(null),o=z(e=>e.camera),s=(0,K.useMemo)(()=>({tint:{value:new k(n)},strength:{value:r?.22:.065}}),[n,r]),c=(0,K.useMemo)(()=>({tint:{value:new k(t?`#ffb340`:`#b8c4d0`)},strength:{value:t?1.25:.65}}),[t]);return L(()=>{a.current&&a.current.quaternion.copy(o.quaternion)}),(0,Z.jsxs)(`group`,{children:[(0,Z.jsx)(`group`,{ref:a,children:(0,Z.jsxs)(`mesh`,{raycast:()=>{},children:[(0,Z.jsx)(`planeGeometry`,{args:[e*4.6,e*4.6]}),(0,Z.jsx)(`shaderMaterial`,{uniforms:c,vertexShader:vt,fragmentShader:wt,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1})]})}),(0,Z.jsxs)(`mesh`,{scale:e*1.025,raycast:()=>{},children:[(0,Z.jsx)(`sphereGeometry`,{args:[1,48,32]}),(0,Z.jsx)(`shaderMaterial`,{uniforms:s,vertexShader:St,fragmentShader:Ct,transparent:!0,blending:2,depthWrite:!1,side:1,toneMapped:!1})]})]})}function Et(e,t,n,r=1.3){let i=Number.isFinite(e)&&e>0?e:0,a=Number.isFinite(t)&&t>0?t:1.05,o=Number.isFinite(n)&&n>0?n:1,s=45*Math.PI/360,c=Math.min(s,Math.atan(Math.tan(s)*o));return Math.max(18,(i+a*2.4)/Math.sin(c)*r)}var Dt={fov:45,minDistance:5,maxDistance:5e3,overviewOffset:[0,72,60]};function Ot(e,t,n,r){let i=-t.clone().applyMatrix4(e.matrixWorldInverse).z;return i<=e.near?0:n*r/(2*Math.tan(re.degToRad(e.fov/2))*i)}function kt({resetKey:e,action:t,positions:n,sizes:r,ringRadius:i,localSystem:a,presentation:o,distantField:s,selectedIds:c,orbitTime:l,sceneElement:u}){let{camera:d,size:f,invalidate:p}=z(),m=(0,K.useRef)(null),h=(0,K.useRef)(null),g=(0,K.useRef)(!0),_=(0,K.useRef)(new S),v=(0,K.useRef)(-1/0),y=(0,K.useMemo)(()=>new S,[]),b=(0,K.useMemo)(()=>new S,[]),x=(0,K.useRef)(c);x.current=c;let C=Et(i,Math.max(1.05,...r.values()),f.width/f.height,(o?1.02:1.3)*(s?1.5:1)),w=Math.max(Dt.maxDistance,C*3);function E(){let e=m.current;e&&(b.set(0,We,0),e.target.copy(b),y.set(...Dt.overviewOffset).setLength(C),d.position.copy(b).add(y),h.current=null,g.current=!0,_.current.copy(b),e.update(),d.updateMatrixWorld(),p())}return(0,K.useLayoutEffect)(E,[d,e]),(0,K.useLayoutEffect)(()=>{g.current&&E()},[C]),(0,K.useLayoutEffect)(()=>{let e=m.current;if(e&&t){if(t.type===`overview`)E();else{if(t.type===`focus-selected`||t.type===`focus-service-system`){let i=t.type===`focus-service-system`?a?.centerNodeId:[...x.current].find(e=>n.current.has(e)),o=i&&n.current.get(i);if(!o||!i){E();return}y.copy(d.position).sub(e.target),y.lengthSq()<.001&&y.set(...Dt.overviewOffset),y.setLength(t.type===`focus-service-system`&&a?Et(a.minorRadius,a.maxPlanetRadius,f.width/f.height):Math.max(6,(r.get(i)??1)*7)),e.target.copy(o),d.position.copy(o).add(y),h.current=i,_.current.copy(o)}else y.copy(d.position).sub(e.target),y.setLength(re.clamp(y.length()*(t.type===`zoom-in`?.68:1.48),Dt.minDistance,w)),d.position.copy(e.target).add(y);g.current=!1,e.update(),d.updateMatrixWorld(),p()}}},[t?.sequence]),L(({clock:e})=>{let t=m.current;if(!t||!(d instanceof T))return;let i=h.current&&n.current.get(h.current);if(i&&(t.target.distanceToSquared(_.current)>.0025?h.current=null:(y.copy(i).sub(_.current),t.target.add(y),d.position.add(y),_.current.copy(i))),d.updateMatrixWorld(),e.elapsedTime-v.current>=.15&&u.current){let i=u.current,a=[...x.current].find(e=>n.current.has(e)),o=a&&n.current.get(a);i.dataset.cameraDistance=t.getDistance().toFixed(2),i.dataset.cameraPosition=d.position.toArray().map(e=>e.toFixed(2)).join(`,`),i.dataset.cameraTarget=t.target.toArray().map(e=>e.toFixed(2)).join(`,`),i.dataset.selectedRadiusPx=o?Ot(d,o,r.get(a)??1,f.height).toFixed(3):`0`,i.dataset.navigationMode=h.current?`following`:g.current?`overview`:`manual`,i.dataset.followedNodeId=h.current??``,i.dataset.orbitTime=l.current.toFixed(3),v.current=e.elapsedTime}},-.5),(0,Z.jsx)(oe,{ref:m,makeDefault:!0,enableDamping:!0,dampingFactor:.085,minDistance:Dt.minDistance,maxDistance:w,onStart:()=>{g.current=!1},minPolarAngle:.005,maxPolarAngle:Math.PI-.005,rotateSpeed:.55,zoomSpeed:1.1,panSpeed:.7,screenSpacePanning:!0,touches:{ONE:P.ROTATE,TWO:P.DOLLY_PAN}})}var At=1.5,jt=1.1,Mt=3.2,Nt=1.15,Pt=18e4,Ft=.1,It={session:`#8fe8f2`,acp:`#c9a6f2`,error:`#ef8f7a`},Lt=Math.PI*2,Q=(e,t=0)=>Number.isFinite(e)?e:t,$=(e,t,n)=>Math.min(n,Math.max(t,e)),Rt=e=>$(Q(e),0,1);function zt(e,t=`voyage`){return(n(`${t}:${e}`)>>>0)/4294967296}function Bt(e,t=`voyage`){return zt(e,t)*Lt}function Vt(e,t){return At+zt(e,`lift:${t}`)*2.5}function Ht(e){return(zt(e,`bow`)*2-1)*jt}function Ut(e){return(zt(e,`berth-offset`)*2-1)*.5}function Wt(e,t=!1){return t?It.error:e===`acp`?It.acp:It.session}function Gt(e){return e.some(e=>e.status===`error`)}function Kt(e,t,n,r,i=0){let a=Math.max(0,Q(n)),o=$(Q(i),-1,1),s=Q(r)+o*.22;e.x=t.x+Math.cos(s)*a,e.y=t.y+Math.abs(o)*.35,e.z=t.z+Math.sin(s)*a}var qt=.36,Jt=1.55,Yt=.34;function Xt(e){return $(Math.max(.2,Q(e,1))*qt/4,.075,.28)}function Zt(e,t,n=Yt){return Bt(e,`destination-orbit`)+Math.max(0,Q(t))/1e3*Q(n,Yt)}function Qt(e,t,n,r,i=0){let a=Math.max(0,Q(n));e.x=t.x+Math.cos(r)*a,e.y=t.y+Math.sin(r*.7)*Math.max(0,Q(i)),e.z=t.z+Math.sin(r)*a}function $t(e){return[-Math.sin(e),0,Math.cos(e)]}function en(e,t,n,r=.3){let i=Math.max(1,Q(t))*Nt,a=Bt(n,`dock`);e.x=Math.cos(a)*i,e.y=Q(r,.3),e.z=Math.sin(a)*i}function tn(e,t,n,r,i=0,a=0){let o=Rt(r);if(o<=0){e.x=t.x,e.y=t.y,e.z=t.z;return}if(o>=1){e.x=n.x,e.y=n.y,e.z=n.z;return}let s=n.x-t.x,c=n.y-t.y,l=n.z-t.z,u=Math.hypot(s,l),d=Math.sin(Math.PI*o),f=u>1e-6?$(Q(a),-1.1,jt)*d:0;e.x=t.x+s*o+(u>1e-6?-l/u:0)*f,e.y=t.y+c*o+Math.max(0,Q(i))*d,e.z=t.z+l*o+(u>1e-6?s/u:0)*f}function nn(e,t){let n=Math.max(0,Math.floor(Q(t)));return n===0?-1:e.phase===`dock`?$(e.leg,1,n):e.phase===`arrived`?n:-1}function rn(e,t=Date.now(),n=Pt){let r=Number.isFinite(n)&&n>0?n:Pt,i=Date.parse(e),a=Number.isFinite(t)?t:Date.now();return Number.isFinite(i)?$(a-i,0,r):0}function an(e,t,n,r){let i=Number.isFinite(n)&&n>0?n:Pt,a=$(Q(e),0,i);if(!r)return a;let o=Q(t);return o<=0?a:$(a+Math.min(o,Ft)*1e3,0,i)}var on=`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,sn=`varying vec2 vUv; uniform vec3 tint; uniform float strength;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  float halo = exp(-r * 3.6) * 0.9 + exp(-r * 12.0) * 0.3;
  gl_FragColor = vec4(tint, halo * strength * (1.0 - smoothstep(0.62, 1.0, r)));
}`;function cn(e){let t=e.projectId??e.id;return{id:e.id,...e.originNodeId?{originNodeId:e.originNodeId}:{},stops:e.stops.map(e=>({id:e.id,...e.nodeId?{nodeId:e.nodeId}:{}})),color:Wt(e.kind,Gt(e.stops)),berthAngle:Bt(t,`berth`),lateral:Ut(e.id),bow:Ht(e.id),lifts:e.stops.map((t,n)=>Vt(e.id,n)),model:e.kind===`acp`?`ship-advanced`:`ship-base`}}function ln(e){for(let t of e.keys())return t}function un({plan:e,positions:t,sizes:n,layoutRadius:r,localNodeId:i,selected:a,onSelect:o,animate:s,cycleStart:c,cycleMs:l}){let u=(0,K.useRef)(null),d=(0,K.useRef)(null),f=(0,K.useRef)(null),p=(0,K.useRef)(null),m=(0,K.useRef)(null),h=(0,K.useRef)(null),g=(0,K.useRef)(null),_=(0,K.useRef)(null),y=(0,K.useRef)(!1),b=(0,K.useRef)(rn(c,Date.now(),l)),x=(0,K.useRef)(0),C=(0,K.useMemo)(()=>Array.from({length:e.stops.length+1},()=>new S),[e.stops.length]),w=(0,K.useMemo)(()=>({point:new S,end:new S,target:new S}),[]),T=(0,K.useMemo)(()=>new Float32Array(Math.max(6,e.stops.length*11*6)),[e.stops.length]),E=(0,K.useMemo)(()=>new Float32Array([0,0,-.52,.08,.04,-.8,-.06,-.03,-1.08,.03,.02,-1.34]),[]),D=(0,K.useMemo)(()=>{let t=new k(e.color),n=new Float32Array(12);return[.9,.6,.34,.15].forEach((e,r)=>n.set([t.r*e,t.g*e,t.b*e],r*3)),n},[e.color]),O=(0,K.useMemo)(()=>({tint:{value:new k(e.color)},strength:{value:.24}}),[e.color]);(0,K.useEffect)(()=>{b.current=rn(c,Date.now(),l),x.current=0},[c,l]),(0,K.useEffect)(()=>()=>{typeof document<`u`&&y.current&&(document.body.style.cursor=``)},[]);let A=(e,t)=>{e.stopPropagation(),typeof document<`u`&&y.current!==t&&(y.current=t,document.body.style.cursor=t?`pointer`:``)};return L((o,c)=>{let y=t.current,S=e.originNodeId??i??ln(y),E=S?y.get(S):void 0;if(!S||!E){u.current&&(u.current.visible=!1),d.current&&(d.current.visible=!1),f.current&&(f.current.visible=!1),p.current&&(p.current.visible=!1),m.current&&(m.current.visible=!1),h.current&&(h.current.visible=!1),_.current&&(_.current.visible=!1);return}let D=e.stops.length,k=n.get(S)??1;Kt(C[0],E,Math.max(.8,k*Mt),e.berthAngle,e.lateral);for(let t=0;t<D;t+=1){let i=e.stops[t],a=i.nodeId?y.get(i.nodeId):void 0,o=C[t+1];if(a){let e=C[t],r=a.x-e.x,s=a.z-e.z,c=Math.hypot(r,s),l=Math.max(.5,(n.get(i.nodeId)??1)*1.08);c>1e-4?o.set(a.x-r/c*l,a.y+Math.min(l*.5,.8),a.z-s/c*l):o.set(a.x,a.y+l,a.z)}else en(o,r,i.id,We+.35)}b.current=an(b.current,c,l,s),s&&(x.current+=Math.min(Math.max(0,c),Ft)*1e3);let A=v(D,b.current,l);if(p.current){if(D===0)p.current.visible=!1;else{let t=p.current.geometry.getAttribute(`position`),n=0;for(let t=0;t<D;t+=1)for(let r=0;r<11;r+=1){let i=r/11,a=(r+1)/11;tn(w.point,C[t],C[t+1],i,e.lifts[t]??0,e.bow),tn(w.end,C[t],C[t+1],a,e.lifts[t]??0,e.bow),T[n]=w.point.x,T[n+1]=w.point.y,T[n+2]=w.point.z,T[n+3]=w.end.x,T[n+4]=w.end.y,T[n+5]=w.end.z,n+=6}t.needsUpdate=!0,p.current.geometry.setDrawRange(0,n/3),p.current.visible=!0}}let j=Xt(k),M=Bt(e.id,`orbit-phase`),N=!1;if(D===0){let t=Zt(e.id,x.current,.5)+M;Qt(w.point,C[0],Math.max(.24,k*.45),t,k*.1),u.current?.position.copy(w.point);let n=$t(t);w.target.copy(w.point).add(w.end.set(n[0],n[1],n[2])),N=!0}else if(A.phase===`arrived`){let t=e.stops[D-1],r=(t.nodeId?y.get(t.nodeId):void 0)??C[D],i=(t.nodeId?n.get(t.nodeId):void 0)??k;j=Xt(i);let a=i*Jt,o=Zt(e.id,x.current)+M;Qt(w.point,r,a,o,a*.16),u.current?.position.copy(w.point);let s=$t(o);w.target.copy(w.point).add(w.end.set(s[0],s[1],s[2])),N=!0}else if(A.phase===`dock`){let t=Math.min(A.leg,D),n=e.stops[t-1],r=n?.nodeId?y.get(n.nodeId):void 0,i=C[t],a=0,o=1;if(r){let e=i.x-r.x,t=i.z-r.z,n=Math.hypot(e,t);n>1e-4&&(a=-t/n,o=e/n)}let s=Math.sin(x.current*.0012+M)*k*.18;w.point.set(i.x+a*s,i.y+Math.sin(x.current*.002+M)*k*.1,i.z+o*s),u.current?.position.copy(w.point),w.target.copy(w.point).add(w.end.set(a,0,o)),N=!0}else if(A.phase===`travel`){let t=Math.min(A.leg,D-1);tn(w.point,C[t],C[t+1],A.t,e.lifts[t]??0,e.bow),w.point.y+=Math.sin(b.current*.0016+M)*.12,u.current?.position.copy(w.point),w.target.copy(C[t+1]),N=!0}else{let t=Zt(e.id,x.current,.5)+M;if(Qt(w.point,C[0],Math.max(.18,k*.3),t,k*.06),u.current?.position.copy(w.point),D>0)w.target.copy(C[1]);else{let e=$t(t);w.target.copy(w.point).add(w.end.set(e[0],e[1],e[2]))}N=!0}if(u.current&&(u.current.visible=!0,u.current.scale.setScalar(j),N&&w.target.distanceToSquared(u.current.position)>1e-6&&u.current.lookAt(w.target)),d.current&&u.current&&(d.current.visible=!0,d.current.position.copy(u.current.position),d.current.quaternion.copy(u.current.quaternion)),f.current&&u.current&&(f.current.visible=!0,f.current.position.copy(u.current.position)),m.current&&(m.current.visible=!0,m.current.position.copy(C[0])),_.current){_.current.visible=!0,u.current&&_.current.position.copy(u.current.position),_.current.quaternion.copy(o.camera.quaternion);let e=Math.max(1.4,k*.8);_.current.scale.set(e,e,1)}if(O.strength.value=a?.46:.28,h.current&&g.current){let t=nn(A,D);if(t>0){let r=e.stops[t-1],i=(r?.nodeId?n.get(r.nodeId):void 0)??1;h.current.visible=!0,h.current.position.copy(C[t]),h.current.position.y+=Math.max(.7,i*1.2);let o=s?b.current/1e3%2/2:.25;h.current.scale.setScalar(Math.max(.5,i*.85)*(.8+o*1.1)),g.current.opacity=(s?1-o:.55)*(a?.42:.26)}else h.current.visible=!1}}),(0,Z.jsxs)(`group`,{children:[e.stops.length>0&&(0,Z.jsxs)(`lineSegments`,{ref:p,visible:!1,frustumCulled:!1,raycast:()=>{},children:[(0,Z.jsx)(`bufferGeometry`,{children:(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[T,3]})},T.length),(0,Z.jsx)(`lineBasicMaterial`,{color:e.color,transparent:!0,opacity:a?.72:.48,blending:2,depthWrite:!1,toneMapped:!1})]}),(0,Z.jsxs)(`group`,{ref:m,visible:!1,children:[(0,Z.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],raycast:()=>{},children:[(0,Z.jsx)(`ringGeometry`,{args:[.58,.68,32]}),(0,Z.jsx)(`meshBasicMaterial`,{color:e.color,transparent:!0,opacity:.38,blending:2,depthWrite:!1,toneMapped:!1,side:2})]}),(0,Z.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],raycast:()=>{},children:[(0,Z.jsx)(`ringGeometry`,{args:[.82,.85,32]}),(0,Z.jsx)(`meshBasicMaterial`,{color:e.color,transparent:!0,opacity:.18,blending:2,depthWrite:!1,toneMapped:!1,side:2})]})]}),(0,Z.jsxs)(`mesh`,{ref:_,visible:!1,scale:[2.8,2.8,1],raycast:()=>{},children:[(0,Z.jsx)(`planeGeometry`,{args:[1,1]}),(0,Z.jsx)(`shaderMaterial`,{uniforms:O,vertexShader:on,fragmentShader:sn,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1,side:2})]}),(0,Z.jsx)(`group`,{ref:u,visible:!1,children:(0,Z.jsx)(K.Suspense,{fallback:(0,Z.jsxs)(`mesh`,{children:[(0,Z.jsx)(`octahedronGeometry`,{args:[.45,0]}),(0,Z.jsx)(`meshBasicMaterial`,{color:e.color,toneMapped:!1})]}),children:(0,Z.jsx)(te,{id:e.model})})}),(0,Z.jsx)(`group`,{ref:d,visible:!1,children:(0,Z.jsxs)(`points`,{raycast:()=>{},frustumCulled:!1,children:[(0,Z.jsxs)(`bufferGeometry`,{children:[(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[E,3]}),(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-color`,args:[D,3]})]}),(0,Z.jsx)(`pointsMaterial`,{vertexColors:!0,size:.18,sizeAttenuation:!0,transparent:!0,opacity:.9,blending:2,depthWrite:!1,toneMapped:!1})]})}),(0,Z.jsxs)(`mesh`,{ref:f,visible:!1,onPointerOver:e=>A(e,!0),onPointerOut:e=>A(e,!1),onClick:t=>{t.stopPropagation(),!(t.delta>6)&&o({type:`voyage`,id:e.id})},children:[(0,Z.jsx)(`sphereGeometry`,{args:[1.15,8,6]}),(0,Z.jsx)(`meshBasicMaterial`,{transparent:!0,opacity:0,depthWrite:!1})]}),(0,Z.jsxs)(`mesh`,{ref:h,visible:!1,rotation:[-Math.PI/2,0,0],raycast:()=>{},children:[(0,Z.jsx)(`ringGeometry`,{args:[.72,.9,40]}),(0,Z.jsx)(`meshBasicMaterial`,{ref:g,color:e.color,transparent:!0,opacity:.26,blending:2,depthWrite:!1,toneMapped:!1,side:2})]})]})}function dn({voyages:e,positions:t,sizes:n,layoutRadius:r,localNodeId:i,selectedId:a,onSelect:o,animate:s,cycleStart:c,cycleMs:l}){let u=(0,K.useMemo)(()=>e.slice(0,8).map(cn),[e]);return u.length?(0,Z.jsx)(`group`,{name:`voyage-fleet`,children:u.map(e=>(0,Z.jsx)(un,{plan:e,positions:t,sizes:n,layoutRadius:r,localNodeId:i,selected:a===e.id,onSelect:o,animate:s,cycleStart:c,cycleMs:l},`${e.id}:${e.stops.length}`))}):null}var fn=[`#8fd8ff`,`#9fe8c9`,`#f0c98a`,`#c7b3ff`];function pn(e){let t=2166136261;for(let n=0;n<e.length;n+=1)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return(t>>>0)/4294967296}function mn(e,t,n=12){let r=Number.isFinite(t)&&t>0?t:20,i=Math.max(1,Math.floor(n));return Array.from({length:i},(t,n)=>{let i=t=>pn(`${e}:distant:${n}:${t}`),a=n*2.399963+i(`angle`)*.7,o=r*(1.5+i(`distance`)*.6),s=(.25+i(`lift`)*.5)*r*.8,c=r*(.08+i(`span`)*.06),l=10+Math.floor(i(`count`)*3),u=Array.from({length:l},(t,i)=>{let a=t=>pn(`${e}:distant:${n}:${i}:${t}`),o=a(`theta`)*Math.PI*2,s=Math.acos(2*a(`phi`)-1),l=c*Math.cbrt(a(`spread`));return{offset:[Math.sin(s)*Math.cos(o)*l,Math.cos(s)*l*.7,Math.sin(s)*Math.sin(o)*l],radius:r*(.008+a(`size`)*.01),color:fn[Math.floor(a(`tone`)*fn.length)%fn.length]}});return{id:`demo:distant-nebula:${n}`,center:[Math.cos(a)*o,s,Math.sin(a)*o],planets:u,haloRadius:c*2.2,haloColor:fn[n%fn.length]}})}function hn({seed:e,ringRadius:t,animate:n}){let r=(0,K.useRef)(null),i=(0,K.useMemo)(()=>mn(e,t),[e,t]),a=(0,K.useMemo)(()=>{let e=document.createElement(`canvas`);e.width=e.height=128;let t=e.getContext(`2d`);if(t){let e=t.createRadialGradient(64,64,0,64,64,64);e.addColorStop(0,`rgba(255,255,255,.75)`),e.addColorStop(.32,`rgba(255,255,255,.22)`),e.addColorStop(1,`rgba(255,255,255,0)`),t.fillStyle=e,t.fillRect(0,0,128,128)}return new ne(e)},[]);return(0,K.useEffect)(()=>()=>a.dispose(),[a]),L((e,t)=>{n&&r.current&&(r.current.rotation.y+=t*.0035)}),(0,Z.jsx)(`group`,{ref:r,raycast:()=>{},children:i.map(e=>(0,Z.jsxs)(`group`,{position:e.center,children:[(0,Z.jsx)(`sprite`,{scale:[e.haloRadius,e.haloRadius,1],raycast:()=>{},children:(0,Z.jsx)(`spriteMaterial`,{map:a,color:e.haloColor,transparent:!0,opacity:.34,blending:2,depthWrite:!1,toneMapped:!1})}),e.planets.map((e,t)=>(0,Z.jsxs)(`mesh`,{position:e.offset,raycast:()=>{},children:[(0,Z.jsx)(`sphereGeometry`,{args:[e.radius,10,8]}),(0,Z.jsx)(`meshBasicMaterial`,{color:e.color,transparent:!0,opacity:.92,blending:2,depthWrite:!1,toneMapped:!1})]},t))]},e.id))})}function gn(e,t){let n=1e3/30,r,i,a=0,o=!1,s=c=>{if(!o){if(r===void 0||c-r>=33.32333333333334){let t=i===void 0?0:Math.min(.1,Math.max(0,(c-i)/1e3));r=r===void 0?c:r+Math.floor((c-r+.01)/n)*n,i=c,e(t)}o||(a=t.request(s))}};return a=t.request(s),()=>{o=!0,t.cancel(a)}}function _n({animate:e,element:t}){let n=z(e=>e.get),r=z(e=>e.advance),i=z(e=>e.invalidate),a=z(e=>e.setFrameloop);return(0,K.useEffect)(()=>{let t,o=()=>{t?.(),t=void 0;let o=n().clock.elapsedTime;if((document.hidden||e)&&(n().internal.frames=0),a(document.hidden||e?`never`:`demand`),n().clock.elapsedTime=o,document.hidden)return;if(!e){i();return}let s=o;t=gn(e=>{s+=e,r(s)},{request:e=>window.requestAnimationFrame(e),cancel:e=>window.cancelAnimationFrame(e)})};return o(),document.addEventListener(`visibilitychange`,o),()=>{t?.(),document.removeEventListener(`visibilitychange`,o)}},[e,r,n,i,a]),(0,K.useEffect)(()=>{if(e)return;let n=t.current,r,a=()=>{i(),window.clearTimeout(r),r=window.setTimeout(i,250)};return n?.addEventListener(`pointermove`,a),n?.addEventListener(`pointerleave`,a),()=>{window.clearTimeout(r),n?.removeEventListener(`pointermove`,a),n?.removeEventListener(`pointerleave`,a)}},[e,t,i]),null}function vn(e,t,n){let r=e.getAttribute(`instanceStart`),i=e.getAttribute(`instanceEnd`),a=e.getAttribute(`instanceDistanceStart`),o=e.getAttribute(`instanceDistanceEnd`);if(!r||!i||!a||!o)return;let s=t.x,c=t.y,l=t.z,u=0;for(let e=0;e<r.count;e++){let d=(e+1)/r.count,f=t.x*(1-d)+n.x*d,p=t.y*(1-d)+n.y*d+Math.sin(d*Math.PI)*3,m=t.z*(1-d)+n.z*d;r.setXYZ(e,s,c,l),i.setXYZ(e,f,p,m),a.setX(e,u),u+=Math.hypot(f-s,p-c,m-l),o.setX(e,u),s=f,c=p,l=m}r.data.needsUpdate=!0,a.data.needsUpdate=!0,e.computeBoundingBox(),e.computeBoundingSphere()}var yn=`#81e7ed`,bn=`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif`,xn=`"SFMono-Regular", Consolas, monospace`;function Sn(e){return e.networkOnline===!1?{label:`网络离线`,color:`#8b98ac`}:at(e)?{label:e.online===!0?`网关在线`:`网络在线`,color:`#8ee0bb`}:e.status===`stale`?{label:`资料过期`,color:`#8b98ac`}:e.online===!1?{label:`网关离线`,color:`#8b98ac`}:e.status===`offline`?{label:`离线待核验`,color:`#8b98ac`}:e.online===null||e.status===`unknown`||e.status===`unavailable`?{label:`待观测`,color:`#e4b87b`}:{label:`网关在线`,color:`#8ee0bb`}}function Cn(){let[e,t]=(0,K.useState)(()=>typeof matchMedia==`function`&&matchMedia(`(prefers-reduced-motion: reduce)`).matches);return(0,K.useEffect)(()=>{if(typeof matchMedia!=`function`)return;let e=matchMedia(`(prefers-reduced-motion: reduce)`),n=()=>t(e.matches);return e.addEventListener(`change`,n),()=>e.removeEventListener(`change`,n)},[]),e}function wn(e,t,r){let i=n(e.layoutScope??`default`),a=`${Oe}.service-systems.${e.mode}.${i}`,o=(0,K.useRef)(null);if(o.current?.key!==a){let e=[];try{let t=JSON.parse(localStorage.getItem(a)??`[]`);Array.isArray(t)&&(e=t)}catch{}o.current={key:a,saved:e,systems:[]}}let s=(0,K.useMemo)(()=>He(e,f(e,t,o.current?.systems),r,o.current?.saved),[e,t.nodeId,t.authority,a,r]);return(0,K.useEffect)(()=>{o.current={key:a,saved:s.assignments,systems:s.systems};try{localStorage.setItem(a,JSON.stringify(s.assignments))}catch{}},[s,a]),s}var Tn=class extends K.Component{state={failed:!1};static getDerivedStateFromError(){return{failed:!0}}render(){return this.state.failed?this.props.fallback:this.props.children}};function En({layout:e,animate:t,time:n,positions:r}){return L((i,a)=>{n.current=et(n.current,a,t);for(let[t,i]of e.plots){let e=r.current.get(t);e||(e=new S,r.current.set(t,e)),e.set(...$e(i,n.current))}},-100),null}function Dn({onFailure:e}){let t=z(e=>e.gl.domElement);return(0,K.useEffect)(()=>{let n=t=>{t.preventDefault(),e()};return t.addEventListener(`webglcontextlost`,n),()=>t.removeEventListener(`webglcontextlost`,n)},[t,e]),null}function On({illuminated:e}){return(0,Z.jsxs)(`mesh`,{children:[(0,Z.jsx)(`sphereGeometry`,{args:[1,32,24]}),(0,Z.jsx)(`meshStandardMaterial`,{color:e?`#465b70`:`#1b2634`,metalness:.5,roughness:.72})]})}function kn({node:e,plot:t,radius:n,selected:r,contents:i,composition:a,selectedServiceId:o,selectedSkillId:s,animate:c,time:l,positions:u,gestureMoved:d,onSelect:f,onEnter:p,onHover:m}){let[h,g]=(0,K.useState)(!1),_=(0,K.useRef)(null),v=(0,K.useRef)(null),y=(0,K.useRef)(null),b=(0,K.useRef)(null),x=(0,K.useRef)(null),S=(0,K.useRef)(null),{camera:C,size:w}=z(),E=(0,K.useMemo)(()=>ze(e.id),[e.id]),D=at(e),O=(0,K.useMemo)(()=>new Float32Array([0,0,0]),[]);L(()=>{let t=u.current.get(e.id);if(_.current&&t&&_.current.position.copy(t),S.current&&S.current.quaternion.set(...Be(E,l.current)),!(C instanceof T)||!t)return;let r=Ot(C,t,n,w.height);v.current&&(v.current.visible=r>=2.2),y.current&&(y.current.visible=r>=7),b.current&&(b.current.visible=r>0&&r<2.2),x.current&&(x.current.size=Math.max(1,Math.min(3,r*2)))});let k=t.role===`relay-center`,A=t.role===`service-center`,j=k?`#efbd70`:A?`#75e5f1`:r||h?ht.ice:`#8995a4`,M=(t,n=!1)=>{t.stopPropagation(),!(t.delta>6||d.current)&&(n?p?.(e.id):f({type:`node`,id:e.id}))};return(0,Z.jsxs)(`group`,{ref:_,position:$e(t,l.current),children:[(0,Z.jsxs)(`group`,{ref:v,onClick:e=>M(e),onDoubleClick:e=>M(e,!0),onPointerOver:e=>{e.stopPropagation(),g(!0)},onPointerOut:()=>g(!1),children:[(0,Z.jsxs)(`group`,{ref:S,scale:n,quaternion:Be(E,l.current),children:[(0,Z.jsx)(K.Suspense,{fallback:(0,Z.jsx)(On,{illuminated:D}),children:(0,Z.jsx)(te,{id:`planet-peripheral`,monochrome:!0,hideOrbitalRelays:!0,illuminated:D})}),(0,Z.jsx)(mt,{composition:a,illuminated:D})]}),(0,Z.jsxs)(`mesh`,{children:[(0,Z.jsx)(`sphereGeometry`,{args:[n*1.1,20,14]}),(0,Z.jsx)(`meshBasicMaterial`,{transparent:!0,opacity:0,depthWrite:!1})]})]}),(0,Z.jsxs)(`points`,{ref:b,visible:!1,onClick:e=>M(e),onDoubleClick:e=>M(e,!0),children:[(0,Z.jsx)(`bufferGeometry`,{children:(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[O,3]})}),(0,Z.jsx)(`pointsMaterial`,{ref:x,color:D?`#a1aab5`:`#34414f`,size:1.5,sizeAttenuation:!1,toneMapped:!1})]}),(0,Z.jsxs)(`group`,{ref:y,children:[D&&(0,Z.jsx)(Tt,{radius:n,core:k,color:j,selected:r||h,animate:c}),k&&(0,Z.jsx)(it,{radius:n,time:l}),A&&(0,Z.jsx)(it,{radius:n,time:l,color:`#75e5f1`}),(0,Z.jsx)(pt,{contents:i,radius:n,seed:e.id,time:l,selectedServiceId:o,selectedSkillId:s,gestureMoved:d,onSelect:f,onHover:m,illuminated:D})]})]})}function An({nodes:e,layout:t,sizes:n,elements:r,selected:i,positions:a,sceneElement:o,pointer:s}){let{camera:c,size:l}=z(),u=(0,K.useMemo)(()=>new S,[]),d=(0,K.useRef)({id:null,lastNear:0});return L(({clock:f})=>{if(!(c instanceof T))return;let p=e.flatMap(e=>{let t=a.current.get(e.id);return!t||(u.copy(t).project(c),u.z<-1||u.z>1)?[]:[{id:e.id,x:(u.x+1)*l.width/2,y:(1-u.y)*l.height/2,radius:Ot(c,t,n.get(e.id)??1,l.height)*1.95+4}]}),m=s.current;if(!m||m.dragging)d.current.id=null;else{let e=d.current.id?r.current.get(d.current.id):void 0,t=e?.style.visibility===`visible`?e.querySelector(`[data-label-body]`)?.getBoundingClientRect():void 0,n=o.current?.getBoundingClientRect(),i=t&&n&&m.x+n.left>=t.left&&m.x+n.left<=t.right&&m.y+n.top>=t.top&&m.y+n.top<=t.bottom,a=i?void 0:p.map(e=>({...e,distance:Math.hypot(e.x-m.x,e.y-m.y)})).filter(e=>e.distance<=Math.max(26,e.radius+12)).sort((e,t)=>e.distance-t.distance)[0];a?(d.current.id=a.id,d.current.lastNear=f.elapsedTime):i?d.current.lastNear=f.elapsedTime:f.elapsedTime-d.current.lastNear>.2&&(d.current.id=null)}o.current&&(o.current.dataset.hoveredNodeId=d.current.id??``);let h=e.flatMap(e=>{let o=r.current.get(e.id),s=t.plots.get(e.id),f=a.current.get(e.id);if(!o||!s||!f)return[];let p=Ot(c,f,n.get(e.id)??1,l.height),m=d.current.id===e.id?p>=3?`full`:`compact`:`hidden`;o.dataset.labelLod=m,o.dataset.labelRevealed=`false`,o.dataset.radiusPx=p.toFixed(2),o.dataset.worldRadius=String(n.get(e.id)),o.dataset.worldPosition=f.toArray().map(e=>e.toFixed(3)).join(`,`),u.copy(f).project(c);let h=(u.x+1)*l.width/2,g=(1-u.y)*l.height/2-p*1.95-7,_=(1-u.y)*l.height/2;return o.dataset.screenPosition=`${h.toFixed(2)},${_.toFixed(2)}`,m===`hidden`||u.z<-1||u.z>1||h<0||h>l.width||_<0||_>l.height?(o.style.visibility=`hidden`,[]):[{element:o,id:e.id,x:h,y:g,width:o.offsetWidth||150,height:o.offsetHeight||58,priority:i.has(e.id)?0:s.role===`relay-center`||s.role===`service-center`?1:2}]}).sort((e,t)=>e.priority-t.priority||e.y-t.y||e.id.localeCompare(t.id)),g=o.current?.getBoundingClientRect(),_=g?[...o.current?.querySelectorAll(`[data-label-obstacle]`)??[]].map(e=>{let t=e.getBoundingClientRect();return{left:t.left-g.left-10,right:t.right-g.left+10,top:t.top-g.top-10,bottom:t.bottom-g.top+10}}):[],v=ke(h,p,l.width,l.height,_);for(let e of h){let t=v.get(e.id);e.element.style.transform=`translate3d(${t.x.toFixed(1)}px,${t.y.toFixed(1)}px,0)`,e.element.style.visibility=t.visible?`visible`:`hidden`,e.element.dataset.labelRevealed=String(t.visible),e.element.style.zIndex=String(10-e.priority)}}),null}function jn({node:e,plot:t,services:n,contents:r,composition:i,selected:a,relay:o,entry:s,system:c,networkPath:d,onSelect:f,onEnter:p,elementRef:m}){let g=Sn(e);return(0,Z.jsx)(`div`,{ref:m,"data-node-id":e.id,"data-illuminated":at(e),"data-storage-bytes":h(e)??`unknown`,"data-satellite-count":r.services.length,"data-skill-star-count":r.skills.length,"data-skills-status":r.skillsStatus,"data-project-storage-status":i.status,"data-project-storage-bytes":i.measuredBytes,"data-project-share":i.totalBytes!==null&&i.remainderBytes!==null?i.measuredBytes/i.totalBytes:`unknown`,"data-relay-center":!!o,"data-service-center":!!s,"data-service-authority":s?.authority,"data-system-id":t.galaxy?.systemId,"data-system-center-id":c?.centerNodeId,"data-major-orbit-radius":t.galaxy?.majorRadius??0,"data-minor-orbit-radius":t.galaxy?.minorRadius??0,"data-major-orbit-inclination":t.galaxy?.majorPlane?.inclination,"data-major-orbit-longitude":t.galaxy?.majorPlane?.longitude,"data-minor-orbit-inclination":t.galaxy?.minorPlane?.inclination,"data-minor-orbit-longitude":t.galaxy?.minorPlane?.longitude,"data-spin-axis":ze(e.id).axis.map(e=>e.toFixed(5)).join(`,`),"data-network-path":d,className:`universe-planet-label`,children:(0,Z.jsxs)(`div`,{"data-label-body":!0,children:[(0,Z.jsxs)(`button`,{type:`button`,"data-label-button":!0,"aria-label":`查看星球 ${e.name}，${g.label}，${l(e)}`,"aria-pressed":a,onClick:t=>{t.stopPropagation(),f({type:`node`,id:e.id})},onDoubleClick:t=>{t.stopPropagation(),p?.(e.id)},style:{width:`100%`,border:`1px solid ${a?`#8ceeffb0`:`#608ba255`}`,borderLeft:`2px solid ${a?`#a5f4ff`:`#4692b7`}`,color:`#e2f4ff`,background:a?`linear-gradient(105deg,#12394bed,#07172aef)`:`linear-gradient(105deg,#0c2031ee,#06101cd9)`,borderRadius:0,clipPath:`polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))`,padding:`8px 10px`,textAlign:`left`,cursor:`pointer`,pointerEvents:`auto`,fontFamily:bn,boxShadow:a?`inset 0 0 22px #55c9ed1f`:`inset 0 1px 0 #76d8ef0e`},children:[(0,Z.jsxs)(`span`,{"data-label-title":!0,children:[(0,Z.jsx)(`span`,{"aria-hidden":`true`,style:{width:5,height:5,borderRadius:`50%`,background:g.color,flexShrink:0}}),(0,Z.jsx)(`strong`,{style:{fontSize:11,overflow:`hidden`,textOverflow:`ellipsis`,whiteSpace:`nowrap`,fontWeight:600,letterSpacing:`.02em`},children:o?`DERP 总中心`:s&&s.authority||e.name})]}),o&&(0,Z.jsx)(`span`,{"data-label-relay":!0,children:u(`${o.host}:${o.port}`,e.name)}),s&&(0,Z.jsxs)(`span`,{"data-label-service":!0,children:[e.name,` · 服务中心`,(0,Z.jsx)(`br`,{}),Math.max(0,(c?.nodeIds.length??1)-1),` 台设备围绕入口公转`]}),!o&&a&&d&&(0,Z.jsx)(`span`,{"data-label-path":!0,children:{self:`服务观察点`,direct:`与观察点直连`,derp:`与观察点经 DERP 中继`,"peer-relay":`与观察点经设备中继`,offline:`设备网络离线`,unknown:`观察点路径待观测`}[d]}),(0,Z.jsxs)(`span`,{"data-label-storage":!0,"data-storage-known":h(e)!==null,children:[l(e),h(e)===null?``:` 存储`]}),(0,Z.jsxs)(`span`,{"data-label-detail":!0,children:[g.label,` · `,n===null?`能力待核验`:`${n} 颗能力卫星`]}),a&&(0,Z.jsx)(`span`,{"data-label-contents":!0,children:r.skillsStatus===`unknown`?`Skill 星点待探查`:`${r.skills.length} 个 Skill 星点${r.skillsStatus===`ok`?``:` · 部分`}`})]}),a&&p&&(0,Z.jsx)(`button`,{type:`button`,"data-label-entry":!0,onClick:()=>p(e.id),style:{pointerEvents:`auto`,width:`100%`,color:yn,cursor:`pointer`,border:`1px solid #76dce745`,background:`#102a39ee`,padding:`7px`,fontSize:10,borderRadius:`0 0 4px 4px`,fontFamily:bn},children:`进入星球基地 →`}),(0,Z.jsx)(`div`,{"data-label-leader":!0,"aria-hidden":`true`,style:{background:`linear-gradient(${a?yn:`#557284`}, transparent)`}})]})})}function Mn({connections:e,positions:t,opacity:n,highlighted:r=!1,color:i}){let a=(0,K.useRef)(null),o=(0,K.useMemo)(()=>new Float32Array(e.length*6),[e]);return L(({camera:n})=>{let r=a.current?.geometry;if(!r||!a.current)return;let i=r.getAttribute(`position`),o=0;e.forEach(({from:e,to:n},r)=>{let a=t.current.get(e),s=t.current.get(n);i.setXYZ(r*2,a?.x??0,a?.y??0,a?.z??0),i.setXYZ(r*2+1,s?.x??0,s?.y??0,s?.z??0),a&&(o=Math.max(o,a.length()))}),i.needsUpdate=!0,a.current.visible=n.position.length()<Math.max(800,o*35)}),e.length?(0,Z.jsxs)(`lineSegments`,{ref:a,frustumCulled:!1,raycast:()=>{},renderOrder:-1,children:[(0,Z.jsx)(`bufferGeometry`,{children:(0,Z.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[o,3]})}),(0,Z.jsx)(`lineBasicMaterial`,{color:i??(r?`#8fe9f1`:`#518ca4`),transparent:!0,opacity:n,depthWrite:!1,toneMapped:!1})]}):null}function Nn({connections:e,selected:t,positions:n,subdued:r=!1}){let i=JSON.stringify([...t].sort()),a=(0,K.useMemo)(()=>e.filter(({from:e,to:n})=>t.has(e)||t.has(n)),[e,i]),o=Math.min(1,Math.sqrt(78/Math.max(1,e.length)));return(0,Z.jsxs)(`group`,{children:[(0,Z.jsx)(Mn,{connections:e,positions:n,opacity:(a.length?.045:r?.065:.2)*o}),(0,Z.jsx)(Mn,{connections:a,positions:n,opacity:r?.18:.58,highlighted:!0})]})}function Pn({event:e,positions:t,onSelect:n,gestureMoved:r}){let i=(0,K.useRef)(null),a=(0,K.useRef)({from:new S(1/0,0,0),to:new S(1/0,0,0)}),o=new S,s=t.current.get(e.nodeId)??o,c=t.current.get(e.targetNodeId)??o,l=(0,K.useMemo)(()=>Array.from({length:17},(e,t)=>{let n=t/16;return[s.x*(1-n)+c.x*n,s.y*(1-n)+c.y*n+Math.sin(n*Math.PI)*3,s.z*(1-n)+c.z*n]}),[e.id]),{camera:u}=z();return(0,K.useLayoutEffect)(()=>{let e=i.current;if(!e)return;let t=e.raycast;return e.raycast=(n,r)=>{e.visible&&t.call(e,n,r)},()=>{e.raycast=t}},[]),L(()=>{let n=t.current.get(e.nodeId),r=t.current.get(e.targetNodeId);i.current&&n&&r&&(i.current.visible=u.position.distanceTo(n)<800&&u.position.distanceTo(r)<800,!(a.current.from.equals(n)&&a.current.to.equals(r))&&(vn(i.current.geometry,n,r),a.current.from.copy(n),a.current.to.copy(r)))}),(0,Z.jsx)(De,{ref:i,points:l,color:`#81d6e6`,transparent:!0,opacity:.6,dashed:!0,dashSize:.3,gapSize:.22,lineWidth:1.2,onClick:t=>{t.stopPropagation(),t.delta<=6&&!r.current&&n({type:`event`,id:e.id})}})}function Fn({props:e,reason:t}){let n=c(e.snapshot,e.selection);return(0,Z.jsxs)(`div`,{"data-testid":`universe-fallback`,style:{height:`100%`,boxSizing:`border-box`,padding:`100px 11% 80px`,overflow:`auto`,color:`#d1e1ec`,background:`radial-gradient(ellipse at 45% 45%, #143049, #050b16 70%)`,fontFamily:bn},children:[(0,Z.jsx)(`div`,{style:{font:`11px ${xn}`,letterSpacing:`.2em`,color:yn},children:`CAPABILITY UNIVERSE`}),(0,Z.jsxs)(`p`,{style:{color:`#93aab9`,fontSize:13},children:[t,` 仍可选择设备查看能力与来源。`]}),(0,Z.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(auto-fit,minmax(180px,1fr))`,gap:20},children:e.snapshot.nodes.filter(t=>!e.visibleNodeIds||e.visibleNodeIds.includes(t.id)).map(t=>(0,Z.jsxs)(`div`,{style:{border:`1px solid ${n.has(t.id)?yn:`#2d4b63`}`,padding:17,borderRadius:8,background:`#112337`},children:[(0,Z.jsxs)(`button`,{type:`button`,onClick:()=>e.onSelect({type:`node`,id:t.id}),"aria-pressed":n.has(t.id),style:{cursor:`pointer`,textAlign:`left`,padding:0,border:0,color:`#dcebf1`,background:`transparent`,width:`100%`,fontFamily:bn},children:[(0,Z.jsx)(`span`,{style:{display:`block`,width:42,height:42,borderRadius:`50%`,background:at(t)?`radial-gradient(circle at 30% 25%, #9abbcb, #354e70 60%, #14213a)`:`radial-gradient(circle at 30% 25%, #253442, #121c28 60%, #0b1320)`,boxShadow:at(t)?`0 0 20px #9cbbd722`:`none`,marginBottom:15}}),(0,Z.jsx)(`strong`,{style:{fontSize:13},children:t.name}),(0,Z.jsx)(`span`,{style:{display:`block`,marginTop:8,fontSize:11},children:l(t)}),(0,Z.jsx)(`span`,{style:{display:`block`,marginTop:9,fontSize:10,color:Sn(t).color},children:Sn(t).label})]}),e.onEnterNode&&(0,Z.jsx)(`button`,{type:`button`,onClick:()=>e.onEnterNode?.(t.id),style:{border:0,background:`transparent`,padding:`14px 0 0`,color:yn,cursor:`pointer`,fontSize:11},children:`进入基地 →`})]},t.id))})]})}function In(e){let{snapshot:n,selection:i,onSelect:l,showConnections:u=!0,resetKey:d=0,paused:f=!1}=e,[h,g]=(0,K.useState)(null),[_,v]=(0,K.useState)(!1),[y,b]=(0,K.useState)(null),x=(0,K.useRef)(null),C=(0,K.useRef)(0),w=(0,K.useRef)(new Map),T=(0,K.useRef)(!1),D=(0,K.useRef)(null),O=(0,K.useRef)(null),k=(0,K.useRef)(new Map),A=s(n),j=a(n,typeof window>`u`?``:window.location.href),M=wn(n,j,A?.nodeId),N=M.systems.find(e=>e.id===M.localSystemId);(0,K.useLayoutEffect)(()=>{for(let[e,t]of M.plots)w.current.set(e,new S(...$e(t,C.current)));for(let e of w.current.keys())M.plots.has(e)||w.current.delete(e)},[M]);let ee=Cn(),P=!f&&!ee,F=c(n,i),I=n.nodes.filter(t=>!e.visibleNodeIds||e.visibleNodeIds.includes(t.id)),L=e.visibleVoyageIds?new Set(e.visibleVoyageIds):void 0,R=e.showVoyages===!1?[]:(n.voyages??[]).filter(e=>!L||L.has(e.id)),z=R.reduce((e,t)=>e+t.stops.length,0),te=R.reduce((e,t)=>e+t.mcpCalls,0),ne=(0,K.useMemo)(()=>new Map(n.nodes.map(e=>[e.id,m(n,e.id)])),[n]),re=(0,K.useMemo)(()=>new Map(n.nodes.map(e=>[e.id,r(n,e.id)])),[n]),ie=new Map(n.nodes.map(e=>[e.id,Ne(n,e.id)])),ae=new Set(I.map(e=>e.id)),oe=y?.type===`service`?y.service.nodeId:y?.type===`skill`?n.services.find(e=>e.id===y.skill.serviceId)?.nodeId:void 0,se=JSON.stringify([...ae].sort()),ce=(0,K.useMemo)(()=>Me([...ae]),[se]),le=(0,K.useMemo)(()=>t(n.network,ae),[n.network,se]),ue={direct:0,derp:0,"peer-relay":0,offline:0,unknown:0};for(let e of n.network?.connections??[])ue[e.kind]+=1;let de=n.mode===`demo`?Date.parse(n.generatedAt):Date.now(),fe=u?p(n,i,ae,de):[];(0,K.useEffect)(()=>{try{let e=document.createElement(`canvas`),t=e.getContext(`webgl2`)||e.getContext(`webgl`);g(!!t),t?.getExtension(`WEBGL_lose_context`)?.loseContext()}catch{g(!1)}},[]);let pe=(0,Z.jsx)(Fn,{props:e,reason:h===null?`正在准备三维显示。`:_?`三维显示已中断，已切换到设备星图。`:`当前环境无法启用三维显示，已切换到设备星图。`});return(0,Z.jsx)(`div`,{ref:x,"data-testid":`universe-scene`,role:`region`,"aria-label":`能力宇宙三维空间；拖动旋转视角，滚轮缩放，触屏单指旋转、双指缩放或平移；单击星球查看指标，双击进入基地。当前服务入口 ${j.authority} 对应的设备为小太阳系中心；能与它直连的设备做小公转，整个星系绕 DERP 总中心做较慢的大公转。金色为观测的 DERP 中继路径，蓝色为直连，淡线为对等关系示意。细星环上每颗卫星代表一个服务能力，每个星点代表一个可见 Skill 包，点击星点阅读完整 Skill 文档。球面颜色显示项目存储占比，灰色为未探查或未归属。公转为示意。`,"data-projection":`perspective`,"data-sizing":`storage-volume`,"data-layout":`service-centered-galaxies`,"data-motion-profile":`independent-spatial-orbits-v10`,"data-label-mode":`proximity`,"data-device-count":n.nodes.length,"data-ring-radius":M.majorRadius.toFixed(4),"data-service-domain":j.authority,"data-service-center-node-id":j.nodeId,"data-system-count":M.systems.length,"data-local-orbit-radius":N?.minorRadius.toFixed(4)??`0`,"data-local-device-count":N?.nodeIds.length??0,"data-major-orbit-radius":M.majorRadius.toFixed(4),"data-layout-envelope":M.radius.toFixed(4),"data-central-relay-node-id":A?.nodeId,"data-orbiting-device-count":n.nodes.length-+!!A,"data-network-status":n.network?.status??`unavailable`,"data-observed-direct-connections":ue.direct,"data-observed-relay-connections":ue.derp,"data-content-model":`capability-satellites-skill-stars`,"data-capability-satellites":I.reduce((e,t)=>e+ne.get(t.id).services.length,0),"data-skill-stars":I.reduce((e,t)=>e+ne.get(t.id).skills.length,0),"data-distant-nebula-count":e.distantNebulae?12:0,"data-orbit-hover":y?.type??``,"data-peer-connections":u?ce.length:0,"data-highlighted-peer-connections":u?ce.filter(({from:e,to:t})=>F.has(e)||F.has(t)).length:0,"data-voyage-count":R.length,"data-voyage-stop-count":z,"data-voyage-mcp-calls":te,"data-voyage-session-count":R.filter(e=>e.kind===`session`).length,"data-voyage-acp-count":R.filter(e=>e.kind===`acp`).length,"data-voyage-cycle-ms":n.refreshIntervalMs,"data-voyage-selected":i?.type===`voyage`?i.id:``,"data-effects-running":P?`true`:`false`,"data-animation-fps":30,onPointerDownCapture:e=>{T.current=!1,D.current={x:e.clientX,y:e.clientY,pointerId:e.pointerId}},onPointerMoveCapture:e=>{let t=D.current;t&&(e.pointerId!==t.pointerId||Math.hypot(e.clientX-t.x,e.clientY-t.y)>6)&&(T.current=!0),e.buttons&&T.current&&b(null);let n=e.currentTarget.getBoundingClientRect();O.current=e.pointerType===`touch`?null:{x:e.clientX-n.left,y:e.clientY-n.top,dragging:e.buttons!==0&&T.current}},onPointerLeave:()=>{O.current=null,b(null)},onPointerCancelCapture:()=>{T.current=!0,D.current=null,O.current=null},style:{width:`100%`,height:`100%`,position:`relative`,overflow:`hidden`,background:ht.background},children:h&&!_?(0,Z.jsxs)(Tn,{fallback:(0,Z.jsx)(Fn,{props:e,reason:`三维素材加载失败，已切换到设备星图。`}),children:[(0,Z.jsxs)(E,{dpr:[1,1.5],frameloop:`never`,camera:{position:[...Dt.overviewOffset],fov:Dt.fov,near:.03,far:3e4},gl:{antialias:!0,alpha:!1,powerPreference:`low-power`},onPointerMissed:()=>{T.current||l(null)},style:{touchAction:`none`},children:[(0,Z.jsx)(`color`,{attach:`background`,args:[ht.background]}),(0,Z.jsx)(`ambientLight`,{intensity:.46,color:`#9fc5ea`}),(0,Z.jsx)(`hemisphereLight`,{args:[`#8ac5ec`,`#030b1b`,1.3]}),(0,Z.jsx)(`directionalLight`,{position:[-15,22,20],color:`#c9edff`,intensity:2.8}),(0,Z.jsx)(`directionalLight`,{position:[20,-4,-8],color:`#4784ff`,intensity:2.2}),(0,Z.jsx)(`pointLight`,{position:[-4,6,4],color:`#ffcf99`,intensity:75,distance:40,decay:2}),(0,Z.jsx)(Dn,{onFailure:()=>v(!0)}),(0,Z.jsx)(_n,{animate:P,element:x}),(0,Z.jsx)(En,{layout:M,animate:P,time:C,positions:w}),(0,Z.jsx)(kt,{resetKey:d,action:e.navAction,presentation:e.presentation,distantField:e.distantNebulae,positions:w,sizes:ie,ringRadius:M.radius,localSystem:N,selectedIds:F,orbitTime:C,sceneElement:x}),(0,Z.jsx)(bt,{animate:P}),(0,Z.jsx)(xt,{animate:P}),e.distantNebulae&&(0,Z.jsx)(hn,{seed:n.layoutScope??`demo`,ringRadius:M.radius,animate:P}),(0,Z.jsx)(rt,{layout:M,positions:w}),u&&(0,Z.jsxs)(Z.Fragment,{children:[(0,Z.jsx)(Nn,{connections:ce,selected:F,positions:w,subdued:!!n.network}),(0,Z.jsx)(Mn,{connections:le.direct,positions:w,opacity:.7,color:`#77dce9`}),(0,Z.jsx)(Mn,{connections:le.derp,positions:w,opacity:.85,color:`#efbd70`})]}),fe.map(e=>(0,Z.jsx)(Pn,{event:e,positions:w,gestureMoved:T,onSelect:l},e.id)),(0,Z.jsx)(dn,{voyages:R,positions:w,sizes:ie,layoutRadius:M.radius,localNodeId:n.serviceNodeId??A?.nodeId,selectedId:i?.type===`voyage`?i.id:void 0,onSelect:l,animate:P,cycleStart:n.generatedAt,cycleMs:n.refreshIntervalMs}),I.map(t=>(0,Z.jsx)(kn,{node:t,plot:M.plots.get(t.id),radius:ie.get(t.id),selected:F.has(t.id),contents:ne.get(t.id),composition:re.get(t.id),selectedServiceId:i?.type===`service`?i.id:void 0,selectedSkillId:i?.type===`skill`&&F.has(t.id)?i.id:void 0,animate:P,time:C,positions:w,gestureMoved:T,onSelect:l,onEnter:e.onEnterNode,onHover:b},t.id)),(0,Z.jsx)(An,{nodes:I,layout:M,sizes:ie,elements:k,selected:F,positions:w,sceneElement:x,pointer:O})]}),(0,Z.jsx)(`div`,{style:{position:`absolute`,inset:0,pointerEvents:`none`,zIndex:2},children:I.map(t=>(0,Z.jsx)(jn,{node:t,plot:M.plots.get(t.id),selected:F.has(t.id),entry:j.nodeId===t.id?j:void 0,system:M.systems.find(e=>e.nodeIds.includes(t.id)),relay:A?.nodeId===t.id?A:void 0,networkPath:n.network?o(n.network,t.id):void 0,contents:ne.get(t.id),composition:re.get(t.id),services:t.catalogAvailable||n.services.some(e=>e.nodeId===t.id)?n.services.filter(e=>e.nodeId===t.id).length:null,onSelect:l,onEnter:e.onEnterNode,elementRef:e=>{e?k.current.set(t.id,e):k.current.delete(t.id)}},t.id))}),y&&oe&&ae.has(oe)&&(0,Z.jsxs)(`div`,{role:`tooltip`,className:`universe-satellite-tooltip${y.type===`skill`?` universe-skill-tooltip`:``}`,style:{left:Math.max(8,Math.min((x.current?.clientWidth??1280)-220,y.clientX-(x.current?.getBoundingClientRect().left??0)+14)),top:Math.max(8,y.clientY-(x.current?.getBoundingClientRect().top??0)-54)},children:[(0,Z.jsx)(`strong`,{children:y.type===`skill`?y.skill.name:y.service.name}),(0,Z.jsx)(`span`,{children:y.type===`skill`?`Skill · 点击阅读文档`:`${y.service.methods.length} 个方法 · 点击查看能力`})]}),(0,Z.jsx)(`div`,{"aria-hidden":`true`,style:{position:`absolute`,inset:0,pointerEvents:`none`,boxShadow:`inset 0 0 130px #01040a88`,background:`radial-gradient(ellipse at 48% 48%, transparent 20%, #01061033 75%)`,zIndex:1}})]}):pe})}export{In as default};