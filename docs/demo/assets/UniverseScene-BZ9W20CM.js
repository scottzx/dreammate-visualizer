import{D as e,_ as t,a as n,c as r,d as i,f as a,g as o,h as s,i as c,l,m as u,o as d,p as f,r as p,s as m,u as h,v as g,w as _,y as v}from"./index-D3wc5P9T.js";import{A as y,E as b,M as x,N as S,O as C,T as w,_ as T,a as E,c as D,d as O,f as k,h as A,i as j,j as M,k as N,l as ee,m as P,o as F,p as I,s as L,t as R,u as z,v as te,x as B,y as ne}from"./AssetModel-LagSme0R.js";import{n as re,t as ie}from"./OrbitControls-CNqsOwdI.js";var ae=j>=125?`uv1`:`uv2`,oe=new ee,se=new M,ce=class extends k{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new O([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new O([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new I(t,6,1);return this.setAttribute(`instanceStart`,new P(n,3,0)),this.setAttribute(`instanceEnd`,new P(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new I(n,t*2,1);return this.setAttribute(`instanceColorStart`,new P(r,t,0)),this.setAttribute(`instanceColorEnd`,new P(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new S(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ee);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),oe.setFromBufferAttribute(t),this.boundingBox.union(oe))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new b),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)se.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(se)),se.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(se));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},le=class extends ce{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},ue=class extends w{constructor(e){super({type:`LineMaterial`,uniforms:N.clone(N.merge([D.common,D.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new y(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
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
					#include <${j>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},de=new x,fe=new M,pe=new M,V=new x,H=new x,U=new x,me=new M,he=new te,W=new A,ge=new M,_e=new ee,ve=new b,G=new x,K,ye;function be(e,t,n){return G.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),G.multiplyScalar(1/G.w),G.x=ye/n.width,G.y=ye/n.height,G.applyMatrix4(e.projectionMatrixInverse),G.multiplyScalar(1/G.w),Math.abs(Math.max(G.x,G.y))}function xe(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){W.start.fromBufferAttribute(i,r),W.end.fromBufferAttribute(a,r),W.applyMatrix4(n);let o=new M,s=new M;K.distanceSqToSegment(W.start,W.end,s,o),s.distanceTo(o)<ye*.5&&t.push({point:s,pointOnLine:o,distance:K.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[ae]:null})}}function Se(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;K.at(1,U),U.w=1,U.applyMatrix4(t.matrixWorldInverse),U.applyMatrix4(r),U.multiplyScalar(1/U.w),U.x*=i.x/2,U.y*=i.y/2,U.z=0,me.copy(U),he.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(V.fromBufferAttribute(s,t),H.fromBufferAttribute(c,t),V.w=1,H.w=1,V.applyMatrix4(he),H.applyMatrix4(he),V.z>u&&H.z>u)continue;if(V.z>u){let e=V.z-H.z,t=(V.z-u)/e;V.lerp(H,t)}else if(H.z>u){let e=H.z-V.z,t=(H.z-u)/e;H.lerp(V,t)}V.applyMatrix4(r),H.applyMatrix4(r),V.multiplyScalar(1/V.w),H.multiplyScalar(1/H.w),V.x*=i.x/2,V.y*=i.y/2,H.x*=i.x/2,H.y*=i.y/2,W.start.copy(V),W.start.z=0,W.end.copy(H),W.end.z=0;let o=W.closestPointToPointParameter(me,!0);W.at(o,ge);let l=T.lerp(V.z,H.z,o),d=l>=-1&&l<=1,f=me.distanceTo(ge)<ye*.5;if(d&&f){W.start.fromBufferAttribute(s,t),W.end.fromBufferAttribute(c,t),W.start.applyMatrix4(a),W.end.applyMatrix4(a);let r=new M,i=new M;K.distanceSqToSegment(W.start,W.end,i,r),n.push({point:i,pointOnLine:r,distance:K.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[ae]:null})}}}var Ce=class extends ne{constructor(e=new ce,t=new ue({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)fe.fromBufferAttribute(t,e),pe.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+fe.distanceTo(pe);let i=new I(r,2,1);return e.setAttribute(`instanceDistanceStart`,new P(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new P(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;K=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;ye=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),ve.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?ye*.5:be(r,Math.max(r.near,ve.distanceToPoint(K.origin)),s.resolution),ve.radius+=c,K.intersectsSphere(ve)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),_e.copy(o.boundingBox).applyMatrix4(a);let l;l=n?ye*.5:be(r,Math.max(r.near,_e.distanceToPoint(K.origin)),s.resolution),_e.expandByScalar(l),K.intersectsBox(_e)!==!1&&(n?xe(this,t):Se(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(de),this.material.uniforms.resolution.value.set(de.z,de.w))}},we=class extends Ce{constructor(e=new le,t=new ue({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},q=e(_()),Te=q.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:i,segments:a,dashed:o,...s},c){var l;let u=L(e=>e.size),d=q.useMemo(()=>a?new Ce:new we,[a]),[f]=q.useState(()=>new ue),p=(n==null||(l=n[0])==null?void 0:l.length)===4?4:3,m=q.useMemo(()=>{let r=a?new ce:new le,i=e.map(e=>{let t=Array.isArray(e);return e instanceof M||e instanceof x?[e.x,e.y,e.z]:e instanceof y?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof z?e.toArray():e);r.setColors(e.flat(),p)}return r},[e,a,n,p]);return q.useLayoutEffect(()=>{d.computeLineDistances()},[e,d]),q.useLayoutEffect(()=>{o?f.defines.USE_DASH=``:delete f.defines.USE_DASH,f.needsUpdate=!0},[o,f]),q.useEffect(()=>()=>{m.dispose(),f.dispose()},[m]),q.createElement(`primitive`,re({object:d,ref:c},s),q.createElement(`primitive`,{object:m,attach:`geometry`}),q.createElement(`primitive`,re({object:f,attach:`material`,color:t,vertexColors:!!n,resolution:[u.width,u.height],linewidth:r??i??1,dashed:o,transparent:p===4},s)))}),Ee=`dreammate.universe-layout.v2`;function De(e,t,n,r,i=[]){let a=new Map,o=[...i],s=[0,-62,62,-124,124,-186,186,-248,248,-310,310].flatMap(e=>[0,-160,160,-320,320,-480,480].map(t=>({dx:t,dy:e}))).sort((e,t)=>e.dx**2+e.dy**2-t.dx**2-t.dy**2);for(let i of[...e].sort((e,t)=>e.priority-t.priority||e.y-t.y||e.id.localeCompare(t.id))){let e=!1;for(let c of s){let s=Math.max(i.width/2+15,Math.min(n-i.width/2-15,i.x+c.dx)),l=i.y+c.dy;if(l<i.height+45||l>r-65)continue;let u={left:s-i.width/2-6,right:s+i.width/2+6,top:l-i.height-6,bottom:l-17+6};if(!o.some(e=>u.left<e.right&&u.right>e.left&&u.top<e.bottom&&u.bottom>e.top)&&!t.some(e=>u.left<e.x+e.radius&&u.right>e.x-e.radius&&u.top<e.y+e.radius&&u.bottom>e.y-e.radius)){o.push(u),a.set(i.id,{x:s,y:l,visible:!0}),e=!0;break}}e||a.set(i.id,{x:i.x,y:i.y,visible:!1})}return a}function Oe(e){return Number.isSafeInteger(e)&&e>0?16/(2*Math.PI)*e:0}function ke(e,t=[],r){let i=[...new Set(e)],a=new Map,o=new Set;for(let e of t)!e||typeof e.id!=`string`||a.has(e.id)||!Number.isSafeInteger(e.slot)||e.slot<0||e.slot>1e5||o.has(e.slot)||(a.set(e.id,e.slot),o.add(e.slot));let s=i.filter(e=>!a.has(e)).sort((e,t)=>n(e)-n(t)||e.localeCompare(t)),c=0;for(let e of a.values())c=Math.max(c,e+1);for(let e of s){for(c>1e5&&(c=0);o.has(c);)c+=1;a.set(e,c),o.add(c),c+=1}let l=new Map,u=i.filter(e=>e!==r),d=Oe(u.length);return i.sort((e,t)=>a.get(e)-a.get(t)),u.sort((e,t)=>a.get(e)-a.get(t)),u.forEach((e,t)=>{let n=t/u.length*Math.PI*2+Math.PI/12;l.set(e,{id:e,slot:a.get(e),orbitRadius:d,x:Math.cos(n)*d,y:.3,z:Math.sin(n)*d})}),r&&i.includes(r)&&l.set(r,{id:r,slot:a.get(r),x:0,y:.3,z:0,orbitRadius:0,role:`relay-center`}),{assignments:[...a].map(([e,t])=>({id:e,slot:t})),plots:l,rings:u.length?[d]:[],radius:d}}function Ae(e){let t=[...new Set(e)].sort();return t.flatMap((e,n)=>t.slice(n+1).map(t=>({from:e,to:t})))}function je(e,t){return i(e.nodes.find(e=>e.id===t))}var J=Math.PI*2,Me=e=>e*Math.PI/180,Y=(e,t=0)=>Number.isFinite(e)?e:t;function X(e,t){let r=n(`${t}:${e}`);return r=Math.imul(r^r>>>16,2146121005),r=Math.imul(r^r>>>15,2221713035),((r^r>>>16)>>>0)/4294967296}function Ne(e,t=.94){return{inclination:Me(18+X(e,`inclination`)*25),longitude:X(e,`longitude`)*J,aspect:t}}function Pe(e,t,n){let r=Math.max(0,Y(e)),i=Y(t)%J,a=Math.max(.8,Math.min(1,Y(n.aspect,.94))),o=Math.max(-Math.PI/3,Math.min(Math.PI/3,Y(n.inclination))),s=Y(n.longitude)%J,c=r*Math.cos(i),l=r*a*Math.sin(i);return[c,(l*Math.cos(s)-c*Math.sin(s))*Math.tan(o),l]}function Fe(e,t){let n=Math.max(-Math.PI/3,Math.min(Math.PI/3,Y(t.inclination)));return Math.max(0,Y(e))/Math.cos(n)}function Ie(e,t,n=160){return Array.from({length:n+1},(r,i)=>Pe(e,i/n*J,t))}function Le(e){let t=Me(22+X(e,`spin-tilt`)*57),n=X(e,`spin-yaw`)*J;return{axis:[Math.sin(t)*Math.cos(n),Math.cos(t),Math.sin(t)*Math.sin(n)],phase:X(e,`spin-phase`)*J,speed:(.045+X(e,`spin-speed`)*.075)*(X(e,`spin-direction`)<.22?-1:1)}}function Re(e,t){let n=Y(t)%(J/Math.abs(e.speed)),r=(e.phase+n*e.speed)/2,i=Math.sin(r);return[e.axis[0]*i,e.axis[1]*i,e.axis[2]*i,Math.cos(r)]}function ze(e){return{rotation:[Me(18+X(e,`ring-tilt`)*48),X(e,`ring-yaw`)*J,(X(e,`ring-roll`)-.5)*.6],speed:.022+X(e,`ring-speed`)*.03,phase:X(e,`ring-phase`)*J}}function Be(e,t,r,i=[]){let a=new Set(e.nodes.map(e=>e.id)),o=new Set,s=new Map(e.nodes.map(t=>[t.id,je(e,t.id)])),c=t.flatMap(e=>{if(!a.has(e.centerNodeId)||o.has(e.centerNodeId))return[];let t=[...new Set(e.nodeIds)].filter(t=>a.has(t)&&!o.has(t)&&(t!==r||t===e.centerNodeId));t.includes(e.centerNodeId)||t.unshift(e.centerNodeId),t.forEach(e=>o.add(e));let i=t.filter(t=>t!==e.centerNodeId),c=s.get(e.centerNodeId),l=Math.max(0,...i.map(e=>s.get(e))),u=Ne(`local:${e.id}`,.9+X(e.id,`local-aspect`)*.08),d=i.length?Math.max(Oe(i.length),12,(c+l)*1.9+4)/u.aspect:0,f=[...i].sort((e,t)=>n(e)-n(t)||e.localeCompare(t));for(let e=0;e<f.length;e++)for(let t=e+1;t<f.length;t++){let n=Math.min(t-e,f.length-(t-e))*Math.PI*2/f.length;d=Math.max(d,((s.get(f[e])+s.get(f[t]))*1.9+2)/(2*u.aspect*Math.sin(n/2)))}let p=Math.max(0,...i.map(e=>Fe(d,Ne(`planet:${e}`,u.aspect)))),m=Math.max(c*1.9+2,p+l*1.9+2);return[{...e,nodeIds:t,majorRadius:0,majorPhase:0,minorRadius:d,minorInclination:u.inclination,majorPlane:Ne(`galactic:${e.id}`),minorPlane:u,minorSpeed:.035*(.85+X(e.id,`local-speed`)*.3),envelope:m,maxPlanetRadius:Math.max(c,l)}]});for(let e of a)if(!o.has(e)&&e!==r){let t=s.get(e);c.push({id:`system:remote:${e}`,kind:`remote`,centerNodeId:e,authority:``,nodeIds:[e],status:`unknown`,majorRadius:0,majorPhase:0,minorRadius:0,minorInclination:0,envelope:t*1.9+2,maxPlanetRadius:t,majorPlane:Ne(`galactic:system:remote:${e}`),minorPlane:Ne(`local:${e}`),minorSpeed:.035})}let l=c.filter(e=>e.centerNodeId!==r),u=ke(l.map(e=>e.id),i);l.sort((e,t)=>u.plots.get(e.id).slot-u.plots.get(t.id).slot);let d=c.find(e=>e.centerNodeId===r)?.envelope??(r&&s.has(r)?s.get(r)*1.9+2:0),f=Math.max(0,...l.map(e=>e.envelope)),p=.94,m=l.length?(d+f+10)/p:0;if(l.length>1)for(let e=0;e<l.length;e++)for(let t=e+1;t<l.length;t++){let n=Math.min(t-e,l.length-(t-e))*Math.PI*2/l.length;m=Math.max(m,(l[e].envelope+l[t].envelope+8)/(2*p*Math.sin(n/2)))}l.forEach((e,t)=>{e.majorRadius=m,e.majorPhase=t/l.length*Math.PI*2+Math.PI/12});let h=new Map;for(let e of c){let t=e.nodeIds.filter(t=>t!==e.centerNodeId).sort((e,t)=>n(e)-n(t)||e.localeCompare(t));for(let n of e.nodeIds){let i=t.indexOf(n),a=i<0?0:i/t.length*Math.PI*2+X(e.id,`local-phase`)*Math.PI*2,o={systemId:e.id,majorRadius:e.majorRadius,majorPhase:e.majorPhase,minorRadius:i<0?0:e.minorRadius,minorPhase:a,minorInclination:e.minorInclination,majorPlane:e.majorPlane,minorPlane:Ne(`planet:${n}`,e.minorPlane.aspect),minorSpeed:e.minorSpeed};h.set(n,{id:n,slot:Math.max(0,i),x:0,y:.3,z:0,orbitRadius:o.minorRadius,role:n===r?`relay-center`:n===e.centerNodeId?e.kind===`entry`?`service-center`:`system-center`:void 0,galaxy:o})}}return r&&a.has(r)&&!h.has(r)&&h.set(r,{id:r,slot:0,x:0,y:.3,z:0,orbitRadius:0,role:`relay-center`}),{assignments:u.assignments,plots:h,rings:m?[m]:[],radius:Math.max(d,...c.map(e=>Fe(e.majorRadius,e.majorPlane)+e.envelope)),systems:c,majorRadius:m,localSystemId:c.find(e=>e.kind===`entry`)?.id}}var Ve=Math.PI*2,He=.3,Ue=.1,Z=(e,t)=>Number.isFinite(e)?e:t;function We(){return 8*Math.PI/180}function Ge(){return .02}var Ke=.006,qe=.035;function Je(e,t){let n=Z(t,0)%(Ve/Ke),r=Z(e.majorPhase,0)+n*Ke;if(!e.majorPlane)return Xe(e.majorRadius,r);let i=Pe(e.majorRadius,r,e.majorPlane);return[i[0],He+i[1],i[2]]}function Ye(e,t,n){let r=Number.isFinite(e)&&e>0?e:0,i=Z(t,0)%Ve,a=Z(n,0);return[r*Math.cos(i),r*Math.sin(i)*Math.sin(a),r*Math.sin(i)*Math.cos(a)]}function Xe(e,t){let n=Number.isFinite(e)&&e>0?e:0,r=Z(t,0)%Ve,i=We(),a=n*Math.sin(r);return[n*Math.cos(r),He+a*Math.sin(i),a*Math.cos(i)]}function Ze(e,t){if(e.role===`relay-center`)return[0,He,0];if(e.galaxy){let n=e.galaxy,r=Je(n,t),i=Number.isFinite(n.minorSpeed)&&n.minorSpeed>0?n.minorSpeed:qe,a=Z(t,0)%(Ve/i),o=Z(n.minorPhase,0)+a*i,s=n.minorPlane?Pe(n.minorRadius,o,n.minorPlane):Ye(n.minorRadius,o,n.minorInclination);return r.map((e,t)=>e+s[t])}let n=Z(e.x,0),r=Z(e.z,0),i=Math.hypot(n,r),a=Number.isFinite(e.orbitRadius)&&e.orbitRadius>0?e.orbitRadius:Number.isFinite(i)?i:0,o=Ge(),s=Z(t,0)%(Ve/o);return Xe(a,Math.atan2(r,n)+s*o)}function Qe(e,t,n){let r=Number.isFinite(e)&&e>=0?e:0;return!n||!Number.isFinite(t)||t<=0?r:r+Math.min(t,Ue)}var Q=g();function $e({radius:e,plane:t,major:n=!1,emphasized:r=!1}){let i=(0,q.useMemo)(()=>Ie(e,t),[e,t.inclination,t.longitude,t.aspect]);return(0,Q.jsx)(Te,{points:i,color:n?`#728ca2`:`#6ee5ef`,lineWidth:n?.7:.85,transparent:!0,opacity:n?r?.28:.14:.28,dashed:n,dashSize:.5,gapSize:.5,raycast:()=>{}})}function et({system:e,layout:t,positions:n}){let r=(0,q.useRef)(null);return F(()=>{let t=n.current.get(e.centerNodeId);t&&r.current&&r.current.position.copy(t)}),(0,Q.jsx)(`group`,{ref:r,children:e.nodeIds.map(e=>{let n=t.plots.get(e)?.galaxy;return n&&n.minorRadius>0&&n.minorPlane?(0,Q.jsx)($e,{radius:n.minorRadius,plane:n.minorPlane},e):null})})}function tt({layout:e,positions:t}){return(0,Q.jsxs)(`group`,{children:[(0,Q.jsx)(`group`,{position:[0,He,0],children:e.systems.filter(e=>e.majorRadius>0).map(e=>(0,Q.jsx)($e,{radius:e.majorRadius,plane:e.majorPlane,major:!0,emphasized:e.kind===`entry`},e.id))}),e.systems.filter(e=>e.minorRadius>0).map(n=>(0,Q.jsx)(et,{system:n,layout:e,positions:t},n.id))]})}function nt({radius:e,time:t,color:n=`#efbd70`}){let r=(0,q.useRef)(null);return F(()=>{r.current&&(r.current.rotation.y=t.current*.08)}),(0,Q.jsxs)(`group`,{ref:r,children:[[1.5,1.9].map((t,r)=>(0,Q.jsxs)(`mesh`,{rotation:[-Math.PI/2+r*.3,r*.4,0],raycast:()=>{},children:[(0,Q.jsx)(`torusGeometry`,{args:[e*t,e*.018,6,96]}),(0,Q.jsx)(`meshBasicMaterial`,{color:n,transparent:!0,opacity:r?.38:.8,depthWrite:!1,toneMapped:!1})]},t)),(0,Q.jsxs)(`mesh`,{position:[0,e*1.85,0],raycast:()=>{},children:[(0,Q.jsx)(`cylinderGeometry`,{args:[e*.012,e*.012,e*1.4,6]}),(0,Q.jsx)(`meshBasicMaterial`,{color:n,transparent:!0,opacity:.7,depthWrite:!1,toneMapped:!1})]}),(0,Q.jsxs)(`mesh`,{position:[0,e*2.65,0],rotation:[0,0,Math.PI/4],raycast:()=>{},children:[(0,Q.jsx)(`octahedronGeometry`,{args:[e*.11]}),(0,Q.jsx)(`meshBasicMaterial`,{color:n,toneMapped:!1})]})]})}function rt(e){return typeof e.networkOnline==`boolean`?e.networkOnline:e.online===!0&&e.status!==`stale`&&e.status!==`offline`}var it=new b,at=new M,ot=new M,st=function(e,t){for(let e=this;e;e=e.parent)if(!e.visible)return;let n=this.geometry.getAttribute(`position`);if(!n?.count)return;let r=this.matrixWorld.getMaxScaleOnAxis()*.065;if(this.geometry.computeBoundingSphere(),it.copy(this.geometry.boundingSphere).applyMatrix4(this.matrixWorld),it.radius+=r,!e.ray.intersectsSphere(it))return;let i,a=r*r;for(let t=0;t<n.count;t++){at.fromBufferAttribute(n,t).applyMatrix4(this.matrixWorld);let r=e.ray.distanceSqToPoint(at);if(r>a)continue;e.ray.closestPointToPoint(at,ot);let o=e.ray.origin.distanceTo(ot);o<e.near||o>e.far||r===a&&i&&o>=i.distance||(a=r,i={distance:o,distanceToRay:Math.sqrt(r),point:ot.clone(),index:t,object:this})}i&&t.push(i)},ct=Math.PI*2,lt=e=>n(e)/4294967295;function ut({service:e,angle:t,selected:n,gestureMoved:r,onSelect:i,onHover:a,illuminated:o}){let[s,c]=(0,q.useState)(!1),l=o?n||s?`#dbfaff`:e.status===`up`?`#7cdef1`:`#8794a4`:`#303b48`,u=t=>{r.current&&t.buttons||(t.stopPropagation(),c(!0),a({type:`service`,service:e,clientX:t.clientX,clientY:t.clientY}))};return(0,Q.jsxs)(`group`,{position:[Math.cos(t)*1.72,.045,Math.sin(t)*1.72],rotation:[0,-t,0],onPointerOver:u,onPointerMove:u,onPointerOut:()=>{c(!1),a(null)},onClick:t=>{t.stopPropagation(),t.delta<=6&&!r.current&&i({type:`service`,id:e.id})},children:[(0,Q.jsxs)(`mesh`,{children:[(0,Q.jsx)(`octahedronGeometry`,{args:[.072,0]}),(0,Q.jsx)(`meshStandardMaterial`,{color:l,emissive:l,emissiveIntensity:o?n||s?1.1:.5:0,metalness:.5,roughness:.3})]}),[-1,1].map(e=>(0,Q.jsxs)(`mesh`,{position:[0,0,e*.105],children:[(0,Q.jsx)(`boxGeometry`,{args:[.09,.014,.12]}),(0,Q.jsx)(`meshStandardMaterial`,{color:l,emissive:l,emissiveIntensity:o?.22:0,metalness:.65,roughness:.35})]},e)),(0,Q.jsxs)(`mesh`,{children:[(0,Q.jsx)(`sphereGeometry`,{args:[.17,8,6]}),(0,Q.jsx)(`meshBasicMaterial`,{transparent:!0,opacity:0,depthWrite:!1})]})]})}function dt({contents:e,radius:t,seed:n,time:r,selectedServiceId:i,selectedSkillId:a,gestureMoved:o,onSelect:s,onHover:c,illuminated:l=!0}){let u=(0,q.useRef)(null),[d,f]=(0,q.useState)(),p=(0,q.useMemo)(()=>ze(n),[n]),m=p.phase,h=(0,q.useMemo)(()=>{let t=new Float32Array(e.skills.length*3);return e.skills.forEach((e,r)=>{let i=lt(`skill-angle:${n}:${e.id}`)*ct,a=1.14+lt(`skill-radius:${n}:${e.id}`)*.39;t.set([Math.cos(i)*a,(lt(`skill-height:${n}:${e.id}`)-.5)*.05,Math.sin(i)*a],r*3)}),t},[e.skills,n]),g=(0,q.useMemo)(()=>{let t=new Float32Array(e.skills.length*3);return e.skills.forEach((e,n)=>{let r=e.id===d||e.id===a,i=new z(r?`#fff2cf`:l?e.cached?`#7f8997`:`#ffda96`:`#303b48`);t.set([i.r,i.g,i.b],n*3)}),t},[e.skills,l,d,a]),_=(0,q.useMemo)(()=>new Float32Array(e.skills.flatMap((e,t)=>e.id===d||e.id===a?Array.from(h.subarray(t*3,t*3+3)):[])),[e.skills,h,d,a]),v=t=>{if(t.stopPropagation(),o.current&&t.buttons)return;let n=t.index===void 0?void 0:e.skills[t.index];n&&(f(n.id),c({type:`skill`,skill:n,clientX:t.clientX,clientY:t.clientY}))};F(()=>{u.current&&(u.current.rotation.y=m-r.current*p.speed)});let y=l?e.catalogKnown?`#81b6c5`:`#8c939f`:`#263341`;return(0,Q.jsx)(`group`,{rotation:p.rotation,scale:t,children:(0,Q.jsxs)(`group`,{ref:u,rotation:[0,m,0],children:[(0,Q.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],raycast:()=>{},children:[(0,Q.jsx)(`torusGeometry`,{args:[1.72,.0045,4,192]}),(0,Q.jsx)(`meshBasicMaterial`,{color:y,transparent:!0,opacity:l?.34:.16,depthWrite:!1,toneMapped:!1})]}),e.skills.length>0&&(0,Q.jsxs)(`points`,{raycast:st,onPointerOver:v,onPointerMove:v,onPointerOut:()=>{f(void 0),c(null)},onClick:t=>{t.stopPropagation();let n=t.index===void 0?void 0:e.skills[t.index];n&&t.delta<=6&&!o.current&&s({type:`skill`,id:n.id,serviceId:n.serviceId})},children:[(0,Q.jsxs)(`bufferGeometry`,{children:[(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[h,3]}),(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-color`,args:[g,3]})]},h.length),(0,Q.jsx)(`pointsMaterial`,{vertexColors:!0,size:t*.026,transparent:!0,opacity:l?.96:.2,blending:2,depthWrite:!1,toneMapped:!1})]}),_.length>0&&(0,Q.jsxs)(`points`,{raycast:()=>{},children:[(0,Q.jsx)(`bufferGeometry`,{children:(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[_,3]})}),(0,Q.jsx)(`pointsMaterial`,{color:`#fff2cf`,size:t*.07,transparent:!0,opacity:.96,blending:2,depthWrite:!1,toneMapped:!1})]}),e.services.map((t,n)=>(0,Q.jsx)(ut,{service:t,angle:n/e.services.length*ct,selected:i===t.id,gestureMoved:o,onSelect:s,onHover:c,illuminated:l},t.id))]})})}function ft({composition:e,illuminated:t=!0}){let n=0;return(0,Q.jsxs)(`group`,{raycast:()=>{},children:[(0,Q.jsxs)(`mesh`,{children:[(0,Q.jsx)(`sphereGeometry`,{args:[.998,64,40]}),(0,Q.jsx)(`meshBasicMaterial`,{color:t?d.unknown:`#1b232d`,transparent:!0,opacity:.12,depthWrite:!1})]}),e.segments.flatMap(e=>{if(e.share===null||e.share<=0)return[];let r=n;return n+=e.share*ct,(0,Q.jsxs)(`mesh`,{children:[(0,Q.jsx)(`sphereGeometry`,{args:[1.027,Math.max(2,Math.ceil(e.share*192)),48,r,e.share*ct]}),(0,Q.jsx)(`meshBasicMaterial`,{color:t?d[e.category]:new z(d[e.category]).multiplyScalar(.12),transparent:!0,opacity:.74,depthWrite:!1,side:2,toneMapped:!1})]},e.category)})]})}var pt={cyan:`#62efff`,ice:`#bcecff`,amber:`#ffbc67`,violet:`#8d74e6`,background:`#020813`,orbitOpacity:.33};function mt(e){let t=n(e);return t=Math.imul(t^t>>>16,2146121005),t=Math.imul(t^t>>>15,2221713035),((t^t>>>16)>>>0)/4294967295}function ht(e,t=0){let n=(0,q.useRef)(t);return F((t,r)=>{e&&(n.current+=Math.min(r,.05))}),n}var gt=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,_t=`
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
`;function vt({animate:e}){let t=(0,q.useRef)(null),n=(0,q.useRef)(null),{camera:r,size:i}=L(),a=(0,q.useMemo)(()=>new M,[]),o=ht(e),s=(0,q.useMemo)(()=>({time:{value:0}}),[]);return F(()=>{if(t.current&&(r.getWorldDirection(a),t.current.position.copy(r.position).addScaledVector(a,150),t.current.quaternion.copy(r.quaternion),r instanceof B&&i.height>0)){let e=300*Math.tan(r.fov*Math.PI/360)/r.zoom;t.current.scale.set(e*i.width/i.height/125*1.2,e/82*1.2,1)}n.current&&(n.current.uniforms.time.value=o.current)}),(0,Q.jsx)(`group`,{ref:t,renderOrder:-100,children:(0,Q.jsxs)(`mesh`,{raycast:()=>{},children:[(0,Q.jsx)(`planeGeometry`,{args:[125,82]}),(0,Q.jsx)(`shaderMaterial`,{ref:n,uniforms:s,vertexShader:gt,fragmentShader:_t,transparent:!0,blending:2,depthWrite:!1})]})})}function yt({animate:e}){let t=(0,q.useRef)(null),n=ht(e,.6),r=(0,q.useMemo)(()=>[3200,180].map((e,t)=>{let n=new Float32Array(e*3);for(let r=0;r<e;r+=1){let e=`stellar-${t}-${r}`,i=mt(`height:${e}`)*2-1,a=mt(`azimuth:${e}`)*Math.PI*2,o=6500+mt(`depth:${e}`)*2500,s=Math.sqrt(Math.max(0,1-i*i));n[r*3]=o*s*Math.cos(a),n[r*3+1]=o*i,n[r*3+2]=o*s*Math.sin(a)}return n}),[]);return F(()=>{t.current&&(t.current.opacity=.67+Math.sin(n.current*.32)*.12)}),(0,Q.jsxs)(`group`,{children:[(0,Q.jsxs)(`points`,{raycast:()=>{},children:[(0,Q.jsx)(`bufferGeometry`,{children:(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[r[0],3]})}),(0,Q.jsx)(`pointsMaterial`,{color:`#8eaccd`,size:1.15,sizeAttenuation:!1,transparent:!0,opacity:.7,depthWrite:!1})]}),(0,Q.jsxs)(`points`,{raycast:()=>{},children:[(0,Q.jsx)(`bufferGeometry`,{children:(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[r[1],3]})}),(0,Q.jsx)(`pointsMaterial`,{ref:t,color:`#c4efff`,size:2.25,sizeAttenuation:!1,transparent:!0,opacity:.74,depthWrite:!1,blending:2})]})]})}var bt=`varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,xt=`uniform vec3 tint;uniform float strength;varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.7);gl_FragColor=vec4(tint,rim*strength);}`,St=`varying vec2 vUv;uniform vec3 tint;uniform float strength;void main(){vec2 p=vUv-.5;float r=length(p);float halo=exp(-r*18.)*.72+exp(-r*r*60.)*.14;float flare=exp(-abs(p.y)*280.)*exp(-abs(p.x)*10.)*.22;vec3 color=mix(tint,vec3(1.,.96,.81),exp(-r*48.));gl_FragColor=vec4(color,(halo+flare)*strength*(1.-smoothstep(.35,.5,r)));}`;function Ct({radius:e,core:t,color:n,selected:r,animate:i}){let a=(0,q.useRef)(null),o=L(e=>e.camera),s=(0,q.useMemo)(()=>({tint:{value:new z(n)},strength:{value:r?.22:.065}}),[n,r]),c=(0,q.useMemo)(()=>({tint:{value:new z(t?`#ffb340`:`#b8c4d0`)},strength:{value:t?1.25:.65}}),[t]);return F(()=>{a.current&&a.current.quaternion.copy(o.quaternion)}),(0,Q.jsxs)(`group`,{children:[(0,Q.jsx)(`group`,{ref:a,children:(0,Q.jsxs)(`mesh`,{raycast:()=>{},children:[(0,Q.jsx)(`planeGeometry`,{args:[e*4.6,e*4.6]}),(0,Q.jsx)(`shaderMaterial`,{uniforms:c,vertexShader:gt,fragmentShader:St,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1})]})}),(0,Q.jsxs)(`mesh`,{scale:e*1.025,raycast:()=>{},children:[(0,Q.jsx)(`sphereGeometry`,{args:[1,48,32]}),(0,Q.jsx)(`shaderMaterial`,{uniforms:s,vertexShader:bt,fragmentShader:xt,transparent:!0,blending:2,depthWrite:!1,side:1,toneMapped:!1})]})]})}function wt(e,t,n){let r=Number.isFinite(e)&&e>0?e:0,i=Number.isFinite(t)&&t>0?t:1.05,a=Number.isFinite(n)&&n>0?n:1,o=45*Math.PI/360,s=Math.min(o,Math.atan(Math.tan(o)*a));return Math.max(18,(r+i*2.4)/Math.sin(s)*1.3)}var Tt={fov:45,minDistance:5,maxDistance:5e3,overviewOffset:[0,72,60]};function Et(e,t,n,r){let i=-t.clone().applyMatrix4(e.matrixWorldInverse).z;return i<=e.near?0:n*r/(2*Math.tan(T.degToRad(e.fov/2))*i)}function Dt({resetKey:e,action:t,positions:n,sizes:r,ringRadius:i,localSystem:a,selectedIds:o,orbitTime:s,sceneElement:c}){let{camera:l,size:u,invalidate:d}=L(),f=(0,q.useRef)(null),p=(0,q.useRef)(null),m=(0,q.useRef)(!0),h=(0,q.useRef)(new M),g=(0,q.useRef)(-1/0),_=(0,q.useMemo)(()=>new M,[]),v=(0,q.useMemo)(()=>new M,[]),y=(0,q.useRef)(o);y.current=o;let b=wt(i,Math.max(1.05,...r.values()),u.width/u.height),x=Math.max(Tt.maxDistance,b*3);function S(){let e=f.current;e&&(v.set(0,He,0),e.target.copy(v),_.set(...Tt.overviewOffset).setLength(b),l.position.copy(v).add(_),p.current=null,m.current=!0,h.current.copy(v),e.update(),l.updateMatrixWorld(),d())}return(0,q.useLayoutEffect)(S,[l,e]),(0,q.useLayoutEffect)(()=>{m.current&&S()},[b]),(0,q.useLayoutEffect)(()=>{let e=f.current;if(e&&t){if(t.type===`overview`)S();else{if(t.type===`focus-selected`||t.type===`focus-service-system`){let i=t.type===`focus-service-system`?a?.centerNodeId:[...y.current].find(e=>n.current.has(e)),o=i&&n.current.get(i);if(!o||!i){S();return}_.copy(l.position).sub(e.target),_.lengthSq()<.001&&_.set(...Tt.overviewOffset),_.setLength(t.type===`focus-service-system`&&a?wt(a.minorRadius,a.maxPlanetRadius,u.width/u.height):Math.max(6,(r.get(i)??1)*7)),e.target.copy(o),l.position.copy(o).add(_),p.current=i,h.current.copy(o)}else _.copy(l.position).sub(e.target),_.setLength(T.clamp(_.length()*(t.type===`zoom-in`?.68:1.48),Tt.minDistance,x)),l.position.copy(e.target).add(_);m.current=!1,e.update(),l.updateMatrixWorld(),d()}}},[t?.sequence]),F(({clock:e})=>{let t=f.current;if(!t||!(l instanceof B))return;let i=p.current&&n.current.get(p.current);if(i&&(t.target.distanceToSquared(h.current)>.0025?p.current=null:(_.copy(i).sub(h.current),t.target.add(_),l.position.add(_),h.current.copy(i))),l.updateMatrixWorld(),e.elapsedTime-g.current>=.15&&c.current){let i=c.current,a=[...y.current].find(e=>n.current.has(e)),o=a&&n.current.get(a);i.dataset.cameraDistance=t.getDistance().toFixed(2),i.dataset.cameraPosition=l.position.toArray().map(e=>e.toFixed(2)).join(`,`),i.dataset.cameraTarget=t.target.toArray().map(e=>e.toFixed(2)).join(`,`),i.dataset.selectedRadiusPx=o?Et(l,o,r.get(a)??1,u.height).toFixed(3):`0`,i.dataset.navigationMode=p.current?`following`:m.current?`overview`:`manual`,i.dataset.followedNodeId=p.current??``,i.dataset.orbitTime=s.current.toFixed(3),g.current=e.elapsedTime}},-.5),(0,Q.jsx)(ie,{ref:f,makeDefault:!0,enableDamping:!0,dampingFactor:.085,minDistance:Tt.minDistance,maxDistance:x,onStart:()=>{m.current=!1},minPolarAngle:.005,maxPolarAngle:Math.PI-.005,rotateSpeed:.55,zoomSpeed:1.1,panSpeed:.7,screenSpacePanning:!0,touches:{ONE:C.ROTATE,TWO:C.DOLLY_PAN}})}var Ot=1.5,kt=1.1,At=3.2,jt=1.15,Mt=18e4,Nt=.1,Pt={session:`#8fe8f2`,acp:`#c9a6f2`,error:`#ef8f7a`},Ft=Math.PI*2,$=(e,t=0)=>Number.isFinite(e)?e:t,It=(e,t,n)=>Math.min(n,Math.max(t,e)),Lt=e=>It($(e),0,1);function Rt(e,t=`voyage`){return(n(`${t}:${e}`)>>>0)/4294967296}function zt(e,t=`voyage`){return Rt(e,t)*Ft}function Bt(e,t){return Ot+Rt(e,`lift:${t}`)*2.5}function Vt(e){return(Rt(e,`bow`)*2-1)*kt}function Ht(e){return(Rt(e,`berth-offset`)*2-1)*.5}function Ut(e,t=!1){return t?Pt.error:e===`acp`?Pt.acp:Pt.session}function Wt(e){return e.some(e=>e.status===`error`)}function Gt(e,t,n,r,i=0){let a=Math.max(0,$(n)),o=It($(i),-1,1),s=$(r)+o*.22;e.x=t.x+Math.cos(s)*a,e.y=t.y+Math.abs(o)*.35,e.z=t.z+Math.sin(s)*a}var Kt=.36,qt=1.55,Jt=.34;function Yt(e){return It(Math.max(.2,$(e,1))*Kt/4,.075,.28)}function Xt(e,t,n=Jt){return zt(e,`destination-orbit`)+Math.max(0,$(t))/1e3*$(n,Jt)}function Zt(e,t,n,r,i=0){let a=Math.max(0,$(n));e.x=t.x+Math.cos(r)*a,e.y=t.y+Math.sin(r*.7)*Math.max(0,$(i)),e.z=t.z+Math.sin(r)*a}function Qt(e){return[-Math.sin(e),0,Math.cos(e)]}function $t(e,t,n,r=.3){let i=Math.max(1,$(t))*jt,a=zt(n,`dock`);e.x=Math.cos(a)*i,e.y=$(r,.3),e.z=Math.sin(a)*i}function en(e,t,n,r,i=0,a=0){let o=Lt(r);if(o<=0){e.x=t.x,e.y=t.y,e.z=t.z;return}if(o>=1){e.x=n.x,e.y=n.y,e.z=n.z;return}let s=n.x-t.x,c=n.y-t.y,l=n.z-t.z,u=Math.hypot(s,l),d=Math.sin(Math.PI*o),f=u>1e-6?It($(a),-1.1,kt)*d:0;e.x=t.x+s*o+(u>1e-6?-l/u:0)*f,e.y=t.y+c*o+Math.max(0,$(i))*d,e.z=t.z+l*o+(u>1e-6?s/u:0)*f}function tn(e,t){let n=Math.max(0,Math.floor($(t)));return n===0?-1:e.phase===`dock`?It(e.leg,1,n):e.phase===`arrived`?n:-1}function nn(e,t=Date.now(),n=Mt){let r=Number.isFinite(n)&&n>0?n:Mt,i=Date.parse(e),a=Number.isFinite(t)?t:Date.now();return Number.isFinite(i)?It(a-i,0,r):0}function rn(e,t,n,r){let i=Number.isFinite(n)&&n>0?n:Mt,a=It($(e),0,i);if(!r)return a;let o=$(t);return o<=0?a:It(a+Math.min(o,Nt)*1e3,0,i)}var an=`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,on=`varying vec2 vUv; uniform vec3 tint; uniform float strength;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  float halo = exp(-r * 3.6) * 0.9 + exp(-r * 12.0) * 0.3;
  gl_FragColor = vec4(tint, halo * strength * (1.0 - smoothstep(0.62, 1.0, r)));
}`;function sn(e){let t=e.projectId??e.id;return{id:e.id,...e.originNodeId?{originNodeId:e.originNodeId}:{},stops:e.stops.map(e=>({id:e.id,...e.nodeId?{nodeId:e.nodeId}:{}})),color:Ut(e.kind,Wt(e.stops)),berthAngle:zt(t,`berth`),lateral:Ht(e.id),bow:Vt(e.id),lifts:e.stops.map((t,n)=>Bt(e.id,n)),model:e.kind===`acp`?`ship-advanced`:`ship-base`}}function cn(e){for(let t of e.keys())return t}function ln({plan:e,positions:t,sizes:n,layoutRadius:r,localNodeId:i,selected:a,onSelect:o,animate:s,cycleStart:c,cycleMs:l}){let u=(0,q.useRef)(null),d=(0,q.useRef)(null),f=(0,q.useRef)(null),p=(0,q.useRef)(null),m=(0,q.useRef)(null),h=(0,q.useRef)(null),g=(0,q.useRef)(null),_=(0,q.useRef)(null),y=(0,q.useRef)(!1),b=(0,q.useRef)(nn(c,Date.now(),l)),x=(0,q.useRef)(0),S=(0,q.useMemo)(()=>Array.from({length:e.stops.length+1},()=>new M),[e.stops.length]),C=(0,q.useMemo)(()=>({point:new M,end:new M,target:new M}),[]),w=(0,q.useMemo)(()=>new Float32Array(Math.max(6,e.stops.length*11*6)),[e.stops.length]),T=(0,q.useMemo)(()=>new Float32Array([0,0,-.52,.08,.04,-.8,-.06,-.03,-1.08,.03,.02,-1.34]),[]),E=(0,q.useMemo)(()=>{let t=new z(e.color),n=new Float32Array(12);return[.9,.6,.34,.15].forEach((e,r)=>n.set([t.r*e,t.g*e,t.b*e],r*3)),n},[e.color]),D=(0,q.useMemo)(()=>({tint:{value:new z(e.color)},strength:{value:.24}}),[e.color]);(0,q.useEffect)(()=>{b.current=nn(c,Date.now(),l),x.current=0},[c,l]),(0,q.useEffect)(()=>()=>{typeof document<`u`&&y.current&&(document.body.style.cursor=``)},[]);let O=(e,t)=>{e.stopPropagation(),typeof document<`u`&&y.current!==t&&(y.current=t,document.body.style.cursor=t?`pointer`:``)};return F((o,c)=>{let y=t.current,T=e.originNodeId??i??cn(y),E=T?y.get(T):void 0;if(!T||!E){u.current&&(u.current.visible=!1),d.current&&(d.current.visible=!1),f.current&&(f.current.visible=!1),p.current&&(p.current.visible=!1),m.current&&(m.current.visible=!1),h.current&&(h.current.visible=!1),_.current&&(_.current.visible=!1);return}let O=e.stops.length,k=n.get(T)??1;Gt(S[0],E,Math.max(.8,k*At),e.berthAngle,e.lateral);for(let t=0;t<O;t+=1){let i=e.stops[t],a=i.nodeId?y.get(i.nodeId):void 0,o=S[t+1];if(a){let e=S[t],r=a.x-e.x,s=a.z-e.z,c=Math.hypot(r,s),l=Math.max(.5,(n.get(i.nodeId)??1)*1.08);c>1e-4?o.set(a.x-r/c*l,a.y+Math.min(l*.5,.8),a.z-s/c*l):o.set(a.x,a.y+l,a.z)}else $t(o,r,i.id,He+.35)}b.current=rn(b.current,c,l,s),s&&(x.current+=Math.min(Math.max(0,c),Nt)*1e3);let A=v(O,b.current,l);if(p.current){if(O===0)p.current.visible=!1;else{let t=p.current.geometry.getAttribute(`position`),n=0;for(let t=0;t<O;t+=1)for(let r=0;r<11;r+=1){let i=r/11,a=(r+1)/11;en(C.point,S[t],S[t+1],i,e.lifts[t]??0,e.bow),en(C.end,S[t],S[t+1],a,e.lifts[t]??0,e.bow),w[n]=C.point.x,w[n+1]=C.point.y,w[n+2]=C.point.z,w[n+3]=C.end.x,w[n+4]=C.end.y,w[n+5]=C.end.z,n+=6}t.needsUpdate=!0,p.current.geometry.setDrawRange(0,n/3),p.current.visible=!0}}let j=Yt(k),M=zt(e.id,`orbit-phase`),N=!1;if(O===0){let t=Xt(e.id,x.current,.5)+M;Zt(C.point,S[0],Math.max(.24,k*.45),t,k*.1),u.current?.position.copy(C.point);let n=Qt(t);C.target.copy(C.point).add(C.end.set(n[0],n[1],n[2])),N=!0}else if(A.phase===`arrived`){let t=e.stops[O-1],r=(t.nodeId?y.get(t.nodeId):void 0)??S[O],i=(t.nodeId?n.get(t.nodeId):void 0)??k;j=Yt(i);let a=i*qt,o=Xt(e.id,x.current)+M;Zt(C.point,r,a,o,a*.16),u.current?.position.copy(C.point);let s=Qt(o);C.target.copy(C.point).add(C.end.set(s[0],s[1],s[2])),N=!0}else if(A.phase===`dock`){let t=Math.min(A.leg,O),n=e.stops[t-1],r=n?.nodeId?y.get(n.nodeId):void 0,i=S[t],a=0,o=1;if(r){let e=i.x-r.x,t=i.z-r.z,n=Math.hypot(e,t);n>1e-4&&(a=-t/n,o=e/n)}let s=Math.sin(x.current*.0012+M)*k*.18;C.point.set(i.x+a*s,i.y+Math.sin(x.current*.002+M)*k*.1,i.z+o*s),u.current?.position.copy(C.point),C.target.copy(C.point).add(C.end.set(a,0,o)),N=!0}else if(A.phase===`travel`){let t=Math.min(A.leg,O-1);en(C.point,S[t],S[t+1],A.t,e.lifts[t]??0,e.bow),C.point.y+=Math.sin(b.current*.0016+M)*.12,u.current?.position.copy(C.point),C.target.copy(S[t+1]),N=!0}else{let t=Xt(e.id,x.current,.5)+M;if(Zt(C.point,S[0],Math.max(.18,k*.3),t,k*.06),u.current?.position.copy(C.point),O>0)C.target.copy(S[1]);else{let e=Qt(t);C.target.copy(C.point).add(C.end.set(e[0],e[1],e[2]))}N=!0}if(u.current&&(u.current.visible=!0,u.current.scale.setScalar(j),N&&C.target.distanceToSquared(u.current.position)>1e-6&&u.current.lookAt(C.target)),d.current&&u.current&&(d.current.visible=!0,d.current.position.copy(u.current.position),d.current.quaternion.copy(u.current.quaternion)),f.current&&u.current&&(f.current.visible=!0,f.current.position.copy(u.current.position)),m.current&&(m.current.visible=!0,m.current.position.copy(S[0])),_.current){_.current.visible=!0,u.current&&_.current.position.copy(u.current.position),_.current.quaternion.copy(o.camera.quaternion);let e=Math.max(1.4,k*.8);_.current.scale.set(e,e,1)}if(D.strength.value=a?.46:.28,h.current&&g.current){let t=tn(A,O);if(t>0){let r=e.stops[t-1],i=(r?.nodeId?n.get(r.nodeId):void 0)??1;h.current.visible=!0,h.current.position.copy(S[t]),h.current.position.y+=Math.max(.7,i*1.2);let o=s?b.current/1e3%2/2:.25;h.current.scale.setScalar(Math.max(.5,i*.85)*(.8+o*1.1)),g.current.opacity=(s?1-o:.55)*(a?.42:.26)}else h.current.visible=!1}}),(0,Q.jsxs)(`group`,{children:[e.stops.length>0&&(0,Q.jsxs)(`lineSegments`,{ref:p,visible:!1,frustumCulled:!1,raycast:()=>{},children:[(0,Q.jsx)(`bufferGeometry`,{children:(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[w,3]})},w.length),(0,Q.jsx)(`lineBasicMaterial`,{color:e.color,transparent:!0,opacity:a?.72:.48,blending:2,depthWrite:!1,toneMapped:!1})]}),(0,Q.jsxs)(`group`,{ref:m,visible:!1,children:[(0,Q.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],raycast:()=>{},children:[(0,Q.jsx)(`ringGeometry`,{args:[.58,.68,32]}),(0,Q.jsx)(`meshBasicMaterial`,{color:e.color,transparent:!0,opacity:.38,blending:2,depthWrite:!1,toneMapped:!1,side:2})]}),(0,Q.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],raycast:()=>{},children:[(0,Q.jsx)(`ringGeometry`,{args:[.82,.85,32]}),(0,Q.jsx)(`meshBasicMaterial`,{color:e.color,transparent:!0,opacity:.18,blending:2,depthWrite:!1,toneMapped:!1,side:2})]})]}),(0,Q.jsxs)(`mesh`,{ref:_,visible:!1,scale:[2.8,2.8,1],raycast:()=>{},children:[(0,Q.jsx)(`planeGeometry`,{args:[1,1]}),(0,Q.jsx)(`shaderMaterial`,{uniforms:D,vertexShader:an,fragmentShader:on,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1,side:2})]}),(0,Q.jsx)(`group`,{ref:u,visible:!1,children:(0,Q.jsx)(q.Suspense,{fallback:(0,Q.jsxs)(`mesh`,{children:[(0,Q.jsx)(`octahedronGeometry`,{args:[.45,0]}),(0,Q.jsx)(`meshBasicMaterial`,{color:e.color,toneMapped:!1})]}),children:(0,Q.jsx)(R,{id:e.model})})}),(0,Q.jsx)(`group`,{ref:d,visible:!1,children:(0,Q.jsxs)(`points`,{raycast:()=>{},frustumCulled:!1,children:[(0,Q.jsxs)(`bufferGeometry`,{children:[(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[T,3]}),(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-color`,args:[E,3]})]}),(0,Q.jsx)(`pointsMaterial`,{vertexColors:!0,size:.18,sizeAttenuation:!0,transparent:!0,opacity:.9,blending:2,depthWrite:!1,toneMapped:!1})]})}),(0,Q.jsxs)(`mesh`,{ref:f,visible:!1,onPointerOver:e=>O(e,!0),onPointerOut:e=>O(e,!1),onClick:t=>{t.stopPropagation(),!(t.delta>6)&&o({type:`voyage`,id:e.id})},children:[(0,Q.jsx)(`sphereGeometry`,{args:[1.15,8,6]}),(0,Q.jsx)(`meshBasicMaterial`,{transparent:!0,opacity:0,depthWrite:!1})]}),(0,Q.jsxs)(`mesh`,{ref:h,visible:!1,rotation:[-Math.PI/2,0,0],raycast:()=>{},children:[(0,Q.jsx)(`ringGeometry`,{args:[.72,.9,40]}),(0,Q.jsx)(`meshBasicMaterial`,{ref:g,color:e.color,transparent:!0,opacity:.26,blending:2,depthWrite:!1,toneMapped:!1,side:2})]})]})}function un({voyages:e,positions:t,sizes:n,layoutRadius:r,localNodeId:i,selectedId:a,onSelect:o,animate:s,cycleStart:c,cycleMs:l}){let u=(0,q.useMemo)(()=>e.slice(0,8).map(sn),[e]);return u.length?(0,Q.jsx)(`group`,{name:`voyage-fleet`,children:u.map(e=>(0,Q.jsx)(ln,{plan:e,positions:t,sizes:n,layoutRadius:r,localNodeId:i,selected:a===e.id,onSelect:o,animate:s,cycleStart:c,cycleMs:l},`${e.id}:${e.stops.length}`))}):null}function dn(e,t){let n=1e3/30,r,i,a=0,o=!1,s=c=>{if(!o){if(r===void 0||c-r>=33.32333333333334){let t=i===void 0?0:Math.min(.1,Math.max(0,(c-i)/1e3));r=r===void 0?c:r+Math.floor((c-r+.01)/n)*n,i=c,e(t)}o||(a=t.request(s))}};return a=t.request(s),()=>{o=!0,t.cancel(a)}}function fn({animate:e,element:t}){let n=L(e=>e.get),r=L(e=>e.advance),i=L(e=>e.invalidate),a=L(e=>e.setFrameloop);return(0,q.useEffect)(()=>{let t,o=()=>{t?.(),t=void 0;let o=n().clock.elapsedTime;if((document.hidden||e)&&(n().internal.frames=0),a(document.hidden||e?`never`:`demand`),n().clock.elapsedTime=o,document.hidden)return;if(!e){i();return}let s=o;t=dn(e=>{s+=e,r(s)},{request:e=>window.requestAnimationFrame(e),cancel:e=>window.cancelAnimationFrame(e)})};return o(),document.addEventListener(`visibilitychange`,o),()=>{t?.(),document.removeEventListener(`visibilitychange`,o)}},[e,r,n,i,a]),(0,q.useEffect)(()=>{if(e)return;let n=t.current,r,a=()=>{i(),window.clearTimeout(r),r=window.setTimeout(i,250)};return n?.addEventListener(`pointermove`,a),n?.addEventListener(`pointerleave`,a),()=>{window.clearTimeout(r),n?.removeEventListener(`pointermove`,a),n?.removeEventListener(`pointerleave`,a)}},[e,t,i]),null}function pn(e,t,n){let r=e.getAttribute(`instanceStart`),i=e.getAttribute(`instanceEnd`),a=e.getAttribute(`instanceDistanceStart`),o=e.getAttribute(`instanceDistanceEnd`);if(!r||!i||!a||!o)return;let s=t.x,c=t.y,l=t.z,u=0;for(let e=0;e<r.count;e++){let d=(e+1)/r.count,f=t.x*(1-d)+n.x*d,p=t.y*(1-d)+n.y*d+Math.sin(d*Math.PI)*3,m=t.z*(1-d)+n.z*d;r.setXYZ(e,s,c,l),i.setXYZ(e,f,p,m),a.setX(e,u),u+=Math.hypot(f-s,p-c,m-l),o.setX(e,u),s=f,c=p,l=m}r.data.needsUpdate=!0,a.data.needsUpdate=!0,e.computeBoundingBox(),e.computeBoundingSphere()}var mn=`#81e7ed`,hn=`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif`,gn=`"SFMono-Regular", Consolas, monospace`;function _n(e){return e.networkOnline===!1?{label:`网络离线`,color:`#8b98ac`}:rt(e)?{label:e.online===!0?`网关在线`:`网络在线`,color:`#8ee0bb`}:e.status===`stale`?{label:`资料过期`,color:`#8b98ac`}:e.online===!1?{label:`网关离线`,color:`#8b98ac`}:e.status===`offline`?{label:`离线待核验`,color:`#8b98ac`}:e.online===null||e.status===`unknown`||e.status===`unavailable`?{label:`待观测`,color:`#e4b87b`}:{label:`网关在线`,color:`#8ee0bb`}}function vn(){let[e,t]=(0,q.useState)(()=>typeof matchMedia==`function`&&matchMedia(`(prefers-reduced-motion: reduce)`).matches);return(0,q.useEffect)(()=>{if(typeof matchMedia!=`function`)return;let e=matchMedia(`(prefers-reduced-motion: reduce)`),n=()=>t(e.matches);return e.addEventListener(`change`,n),()=>e.removeEventListener(`change`,n)},[]),e}function yn(e,t,r){let i=n(e.layoutScope??`default`),a=`${Ee}.service-systems.${e.mode}.${i}`,o=(0,q.useRef)(null);if(o.current?.key!==a){let e=[];try{let t=JSON.parse(localStorage.getItem(a)??`[]`);Array.isArray(t)&&(e=t)}catch{}o.current={key:a,saved:e,systems:[]}}let s=(0,q.useMemo)(()=>Be(e,f(e,t,o.current?.systems),r,o.current?.saved),[e,t.nodeId,t.authority,a,r]);return(0,q.useEffect)(()=>{o.current={key:a,saved:s.assignments,systems:s.systems};try{localStorage.setItem(a,JSON.stringify(s.assignments))}catch{}},[s,a]),s}var bn=class extends q.Component{state={failed:!1};static getDerivedStateFromError(){return{failed:!0}}render(){return this.state.failed?this.props.fallback:this.props.children}};function xn({layout:e,animate:t,time:n,positions:r}){return F((i,a)=>{n.current=Qe(n.current,a,t);for(let[t,i]of e.plots){let e=r.current.get(t);e||(e=new M,r.current.set(t,e)),e.set(...Ze(i,n.current))}},-100),null}function Sn({onFailure:e}){let t=L(e=>e.gl.domElement);return(0,q.useEffect)(()=>{let n=t=>{t.preventDefault(),e()};return t.addEventListener(`webglcontextlost`,n),()=>t.removeEventListener(`webglcontextlost`,n)},[t,e]),null}function Cn({illuminated:e}){return(0,Q.jsxs)(`mesh`,{children:[(0,Q.jsx)(`sphereGeometry`,{args:[1,32,24]}),(0,Q.jsx)(`meshStandardMaterial`,{color:e?`#465b70`:`#1b2634`,metalness:.5,roughness:.72})]})}function wn({node:e,plot:t,radius:n,selected:r,contents:i,composition:a,selectedServiceId:o,selectedSkillId:s,animate:c,time:l,positions:u,gestureMoved:d,onSelect:f,onEnter:p,onHover:m}){let[h,g]=(0,q.useState)(!1),_=(0,q.useRef)(null),v=(0,q.useRef)(null),y=(0,q.useRef)(null),b=(0,q.useRef)(null),x=(0,q.useRef)(null),S=(0,q.useRef)(null),{camera:C,size:w}=L(),T=(0,q.useMemo)(()=>Le(e.id),[e.id]),E=rt(e),D=(0,q.useMemo)(()=>new Float32Array([0,0,0]),[]);F(()=>{let t=u.current.get(e.id);if(_.current&&t&&_.current.position.copy(t),S.current&&S.current.quaternion.set(...Re(T,l.current)),!(C instanceof B)||!t)return;let r=Et(C,t,n,w.height);v.current&&(v.current.visible=r>=2.2),y.current&&(y.current.visible=r>=7),b.current&&(b.current.visible=r>0&&r<2.2),x.current&&(x.current.size=Math.max(1,Math.min(3,r*2)))});let O=t.role===`relay-center`,k=t.role===`service-center`,A=O?`#efbd70`:k?`#75e5f1`:r||h?pt.ice:`#8995a4`,j=(t,n=!1)=>{t.stopPropagation(),!(t.delta>6||d.current)&&(n?p?.(e.id):f({type:`node`,id:e.id}))};return(0,Q.jsxs)(`group`,{ref:_,position:Ze(t,l.current),children:[(0,Q.jsxs)(`group`,{ref:v,onClick:e=>j(e),onDoubleClick:e=>j(e,!0),onPointerOver:e=>{e.stopPropagation(),g(!0)},onPointerOut:()=>g(!1),children:[(0,Q.jsxs)(`group`,{ref:S,scale:n,quaternion:Re(T,l.current),children:[(0,Q.jsx)(q.Suspense,{fallback:(0,Q.jsx)(Cn,{illuminated:E}),children:(0,Q.jsx)(R,{id:`planet-peripheral`,monochrome:!0,hideOrbitalRelays:!0,illuminated:E})}),(0,Q.jsx)(ft,{composition:a,illuminated:E})]}),(0,Q.jsxs)(`mesh`,{children:[(0,Q.jsx)(`sphereGeometry`,{args:[n*1.1,20,14]}),(0,Q.jsx)(`meshBasicMaterial`,{transparent:!0,opacity:0,depthWrite:!1})]})]}),(0,Q.jsxs)(`points`,{ref:b,visible:!1,onClick:e=>j(e),onDoubleClick:e=>j(e,!0),children:[(0,Q.jsx)(`bufferGeometry`,{children:(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[D,3]})}),(0,Q.jsx)(`pointsMaterial`,{ref:x,color:E?`#a1aab5`:`#34414f`,size:1.5,sizeAttenuation:!1,toneMapped:!1})]}),(0,Q.jsxs)(`group`,{ref:y,children:[E&&(0,Q.jsx)(Ct,{radius:n,core:O,color:A,selected:r||h,animate:c}),O&&(0,Q.jsx)(nt,{radius:n,time:l}),k&&(0,Q.jsx)(nt,{radius:n,time:l,color:`#75e5f1`}),(0,Q.jsx)(dt,{contents:i,radius:n,seed:e.id,time:l,selectedServiceId:o,selectedSkillId:s,gestureMoved:d,onSelect:f,onHover:m,illuminated:E})]})]})}function Tn({nodes:e,layout:t,sizes:n,elements:r,selected:i,positions:a,sceneElement:o,pointer:s}){let{camera:c,size:l}=L(),u=(0,q.useMemo)(()=>new M,[]),d=(0,q.useRef)({id:null,lastNear:0});return F(({clock:f})=>{if(!(c instanceof B))return;let p=e.flatMap(e=>{let t=a.current.get(e.id);return!t||(u.copy(t).project(c),u.z<-1||u.z>1)?[]:[{id:e.id,x:(u.x+1)*l.width/2,y:(1-u.y)*l.height/2,radius:Et(c,t,n.get(e.id)??1,l.height)*1.95+4}]}),m=s.current;if(!m||m.dragging)d.current.id=null;else{let e=d.current.id?r.current.get(d.current.id):void 0,t=e?.style.visibility===`visible`?e.querySelector(`[data-label-body]`)?.getBoundingClientRect():void 0,n=o.current?.getBoundingClientRect(),i=t&&n&&m.x+n.left>=t.left&&m.x+n.left<=t.right&&m.y+n.top>=t.top&&m.y+n.top<=t.bottom,a=i?void 0:p.map(e=>({...e,distance:Math.hypot(e.x-m.x,e.y-m.y)})).filter(e=>e.distance<=Math.max(26,e.radius+12)).sort((e,t)=>e.distance-t.distance)[0];a?(d.current.id=a.id,d.current.lastNear=f.elapsedTime):i?d.current.lastNear=f.elapsedTime:f.elapsedTime-d.current.lastNear>.2&&(d.current.id=null)}o.current&&(o.current.dataset.hoveredNodeId=d.current.id??``);let h=e.flatMap(e=>{let o=r.current.get(e.id),s=t.plots.get(e.id),f=a.current.get(e.id);if(!o||!s||!f)return[];let p=Et(c,f,n.get(e.id)??1,l.height),m=d.current.id===e.id?p>=3?`full`:`compact`:`hidden`;o.dataset.labelLod=m,o.dataset.labelRevealed=`false`,o.dataset.radiusPx=p.toFixed(2),o.dataset.worldRadius=String(n.get(e.id)),o.dataset.worldPosition=f.toArray().map(e=>e.toFixed(3)).join(`,`),u.copy(f).project(c);let h=(u.x+1)*l.width/2,g=(1-u.y)*l.height/2-p*1.95-7,_=(1-u.y)*l.height/2;return o.dataset.screenPosition=`${h.toFixed(2)},${_.toFixed(2)}`,m===`hidden`||u.z<-1||u.z>1||h<0||h>l.width||_<0||_>l.height?(o.style.visibility=`hidden`,[]):[{element:o,id:e.id,x:h,y:g,width:o.offsetWidth||150,height:o.offsetHeight||58,priority:i.has(e.id)?0:s.role===`relay-center`||s.role===`service-center`?1:2}]}).sort((e,t)=>e.priority-t.priority||e.y-t.y||e.id.localeCompare(t.id)),g=o.current?.getBoundingClientRect(),_=g?[...o.current?.querySelectorAll(`[data-label-obstacle]`)??[]].map(e=>{let t=e.getBoundingClientRect();return{left:t.left-g.left-10,right:t.right-g.left+10,top:t.top-g.top-10,bottom:t.bottom-g.top+10}}):[],v=De(h,p,l.width,l.height,_);for(let e of h){let t=v.get(e.id);e.element.style.transform=`translate3d(${t.x.toFixed(1)}px,${t.y.toFixed(1)}px,0)`,e.element.style.visibility=t.visible?`visible`:`hidden`,e.element.dataset.labelRevealed=String(t.visible),e.element.style.zIndex=String(10-e.priority)}}),null}function En({node:e,plot:t,services:n,contents:r,composition:i,selected:a,relay:o,entry:s,system:c,networkPath:d,onSelect:f,onEnter:p,elementRef:m}){let g=_n(e);return(0,Q.jsx)(`div`,{ref:m,"data-node-id":e.id,"data-illuminated":rt(e),"data-storage-bytes":h(e)??`unknown`,"data-satellite-count":r.services.length,"data-skill-star-count":r.skills.length,"data-skills-status":r.skillsStatus,"data-project-storage-status":i.status,"data-project-storage-bytes":i.measuredBytes,"data-project-share":i.totalBytes!==null&&i.remainderBytes!==null?i.measuredBytes/i.totalBytes:`unknown`,"data-relay-center":!!o,"data-service-center":!!s,"data-service-authority":s?.authority,"data-system-id":t.galaxy?.systemId,"data-system-center-id":c?.centerNodeId,"data-major-orbit-radius":t.galaxy?.majorRadius??0,"data-minor-orbit-radius":t.galaxy?.minorRadius??0,"data-major-orbit-inclination":t.galaxy?.majorPlane?.inclination,"data-major-orbit-longitude":t.galaxy?.majorPlane?.longitude,"data-minor-orbit-inclination":t.galaxy?.minorPlane?.inclination,"data-minor-orbit-longitude":t.galaxy?.minorPlane?.longitude,"data-spin-axis":Le(e.id).axis.map(e=>e.toFixed(5)).join(`,`),"data-network-path":d,className:`universe-planet-label`,children:(0,Q.jsxs)(`div`,{"data-label-body":!0,children:[(0,Q.jsxs)(`button`,{type:`button`,"data-label-button":!0,"aria-label":`查看星球 ${e.name}，${g.label}，${l(e)}`,"aria-pressed":a,onClick:t=>{t.stopPropagation(),f({type:`node`,id:e.id})},onDoubleClick:t=>{t.stopPropagation(),p?.(e.id)},style:{width:`100%`,border:`1px solid ${a?`#8ceeffb0`:`#608ba255`}`,borderLeft:`2px solid ${a?`#a5f4ff`:`#4692b7`}`,color:`#e2f4ff`,background:a?`linear-gradient(105deg,#12394bed,#07172aef)`:`linear-gradient(105deg,#0c2031ee,#06101cd9)`,borderRadius:0,clipPath:`polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))`,padding:`8px 10px`,textAlign:`left`,cursor:`pointer`,pointerEvents:`auto`,fontFamily:hn,boxShadow:a?`inset 0 0 22px #55c9ed1f`:`inset 0 1px 0 #76d8ef0e`},children:[(0,Q.jsxs)(`span`,{"data-label-title":!0,children:[(0,Q.jsx)(`span`,{"aria-hidden":`true`,style:{width:5,height:5,borderRadius:`50%`,background:g.color,flexShrink:0}}),(0,Q.jsx)(`strong`,{style:{fontSize:11,overflow:`hidden`,textOverflow:`ellipsis`,whiteSpace:`nowrap`,fontWeight:600,letterSpacing:`.02em`},children:o?`DERP 总中心`:s&&s.authority||e.name})]}),o&&(0,Q.jsx)(`span`,{"data-label-relay":!0,children:u(`${o.host}:${o.port}`,e.name)}),s&&(0,Q.jsxs)(`span`,{"data-label-service":!0,children:[e.name,` · 服务中心`,(0,Q.jsx)(`br`,{}),Math.max(0,(c?.nodeIds.length??1)-1),` 台设备围绕入口公转`]}),!o&&a&&d&&(0,Q.jsx)(`span`,{"data-label-path":!0,children:{self:`服务观察点`,direct:`与观察点直连`,derp:`与观察点经 DERP 中继`,"peer-relay":`与观察点经设备中继`,offline:`设备网络离线`,unknown:`观察点路径待观测`}[d]}),(0,Q.jsxs)(`span`,{"data-label-storage":!0,"data-storage-known":h(e)!==null,children:[l(e),h(e)===null?``:` 存储`]}),(0,Q.jsxs)(`span`,{"data-label-detail":!0,children:[g.label,` · `,n===null?`能力待核验`:`${n} 颗能力卫星`]}),a&&(0,Q.jsx)(`span`,{"data-label-contents":!0,children:r.skillsStatus===`unknown`?`Skill 星点待探查`:`${r.skills.length} 个 Skill 星点${r.skillsStatus===`ok`?``:` · 部分`}`})]}),a&&p&&(0,Q.jsx)(`button`,{type:`button`,"data-label-entry":!0,onClick:()=>p(e.id),style:{pointerEvents:`auto`,width:`100%`,color:mn,cursor:`pointer`,border:`1px solid #76dce745`,background:`#102a39ee`,padding:`7px`,fontSize:10,borderRadius:`0 0 4px 4px`,fontFamily:hn},children:`进入星球基地 →`}),(0,Q.jsx)(`div`,{"data-label-leader":!0,"aria-hidden":`true`,style:{background:`linear-gradient(${a?mn:`#557284`}, transparent)`}})]})})}function Dn({connections:e,positions:t,opacity:n,highlighted:r=!1,color:i}){let a=(0,q.useRef)(null),o=(0,q.useMemo)(()=>new Float32Array(e.length*6),[e]);return F(({camera:n})=>{let r=a.current?.geometry;if(!r||!a.current)return;let i=r.getAttribute(`position`),o=0;e.forEach(({from:e,to:n},r)=>{let a=t.current.get(e),s=t.current.get(n);i.setXYZ(r*2,a?.x??0,a?.y??0,a?.z??0),i.setXYZ(r*2+1,s?.x??0,s?.y??0,s?.z??0),a&&(o=Math.max(o,a.length()))}),i.needsUpdate=!0,a.current.visible=n.position.length()<Math.max(800,o*35)}),e.length?(0,Q.jsxs)(`lineSegments`,{ref:a,frustumCulled:!1,raycast:()=>{},renderOrder:-1,children:[(0,Q.jsx)(`bufferGeometry`,{children:(0,Q.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[o,3]})}),(0,Q.jsx)(`lineBasicMaterial`,{color:i??(r?`#8fe9f1`:`#518ca4`),transparent:!0,opacity:n,depthWrite:!1,toneMapped:!1})]}):null}function On({connections:e,selected:t,positions:n,subdued:r=!1}){let i=JSON.stringify([...t].sort()),a=(0,q.useMemo)(()=>e.filter(({from:e,to:n})=>t.has(e)||t.has(n)),[e,i]),o=Math.min(1,Math.sqrt(78/Math.max(1,e.length)));return(0,Q.jsxs)(`group`,{children:[(0,Q.jsx)(Dn,{connections:e,positions:n,opacity:(a.length?.045:r?.065:.2)*o}),(0,Q.jsx)(Dn,{connections:a,positions:n,opacity:r?.18:.58,highlighted:!0})]})}function kn({event:e,positions:t,onSelect:n,gestureMoved:r}){let i=(0,q.useRef)(null),a=(0,q.useRef)({from:new M(1/0,0,0),to:new M(1/0,0,0)}),o=new M,s=t.current.get(e.nodeId)??o,c=t.current.get(e.targetNodeId)??o,l=(0,q.useMemo)(()=>Array.from({length:17},(e,t)=>{let n=t/16;return[s.x*(1-n)+c.x*n,s.y*(1-n)+c.y*n+Math.sin(n*Math.PI)*3,s.z*(1-n)+c.z*n]}),[e.id]),{camera:u}=L();return(0,q.useLayoutEffect)(()=>{let e=i.current;if(!e)return;let t=e.raycast;return e.raycast=(n,r)=>{e.visible&&t.call(e,n,r)},()=>{e.raycast=t}},[]),F(()=>{let n=t.current.get(e.nodeId),r=t.current.get(e.targetNodeId);i.current&&n&&r&&(i.current.visible=u.position.distanceTo(n)<800&&u.position.distanceTo(r)<800,!(a.current.from.equals(n)&&a.current.to.equals(r))&&(pn(i.current.geometry,n,r),a.current.from.copy(n),a.current.to.copy(r)))}),(0,Q.jsx)(Te,{ref:i,points:l,color:`#81d6e6`,transparent:!0,opacity:.6,dashed:!0,dashSize:.3,gapSize:.22,lineWidth:1.2,onClick:t=>{t.stopPropagation(),t.delta<=6&&!r.current&&n({type:`event`,id:e.id})}})}function An({props:e,reason:t}){let n=c(e.snapshot,e.selection);return(0,Q.jsxs)(`div`,{"data-testid":`universe-fallback`,style:{height:`100%`,boxSizing:`border-box`,padding:`100px 11% 80px`,overflow:`auto`,color:`#d1e1ec`,background:`radial-gradient(ellipse at 45% 45%, #143049, #050b16 70%)`,fontFamily:hn},children:[(0,Q.jsx)(`div`,{style:{font:`11px ${gn}`,letterSpacing:`.2em`,color:mn},children:`CAPABILITY UNIVERSE`}),(0,Q.jsxs)(`p`,{style:{color:`#93aab9`,fontSize:13},children:[t,` 仍可选择设备查看能力与来源。`]}),(0,Q.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(auto-fit,minmax(180px,1fr))`,gap:20},children:e.snapshot.nodes.filter(t=>!e.visibleNodeIds||e.visibleNodeIds.includes(t.id)).map(t=>(0,Q.jsxs)(`div`,{style:{border:`1px solid ${n.has(t.id)?mn:`#2d4b63`}`,padding:17,borderRadius:8,background:`#112337`},children:[(0,Q.jsxs)(`button`,{type:`button`,onClick:()=>e.onSelect({type:`node`,id:t.id}),"aria-pressed":n.has(t.id),style:{cursor:`pointer`,textAlign:`left`,padding:0,border:0,color:`#dcebf1`,background:`transparent`,width:`100%`,fontFamily:hn},children:[(0,Q.jsx)(`span`,{style:{display:`block`,width:42,height:42,borderRadius:`50%`,background:rt(t)?`radial-gradient(circle at 30% 25%, #9abbcb, #354e70 60%, #14213a)`:`radial-gradient(circle at 30% 25%, #253442, #121c28 60%, #0b1320)`,boxShadow:rt(t)?`0 0 20px #9cbbd722`:`none`,marginBottom:15}}),(0,Q.jsx)(`strong`,{style:{fontSize:13},children:t.name}),(0,Q.jsx)(`span`,{style:{display:`block`,marginTop:8,fontSize:11},children:l(t)}),(0,Q.jsx)(`span`,{style:{display:`block`,marginTop:9,fontSize:10,color:_n(t).color},children:_n(t).label})]}),e.onEnterNode&&(0,Q.jsx)(`button`,{type:`button`,onClick:()=>e.onEnterNode?.(t.id),style:{border:0,background:`transparent`,padding:`14px 0 0`,color:mn,cursor:`pointer`,fontSize:11},children:`进入基地 →`})]},t.id))})]})}function jn(e){let{snapshot:n,selection:i,onSelect:l,showConnections:u=!0,resetKey:d=0,paused:f=!1}=e,[h,g]=(0,q.useState)(null),[_,v]=(0,q.useState)(!1),[y,b]=(0,q.useState)(null),x=(0,q.useRef)(null),S=(0,q.useRef)(0),C=(0,q.useRef)(new Map),w=(0,q.useRef)(!1),T=(0,q.useRef)(null),D=(0,q.useRef)(null),O=(0,q.useRef)(new Map),k=s(n),A=a(n,typeof window>`u`?``:window.location.href),j=yn(n,A,k?.nodeId),N=j.systems.find(e=>e.id===j.localSystemId);(0,q.useLayoutEffect)(()=>{for(let[e,t]of j.plots)C.current.set(e,new M(...Ze(t,S.current)));for(let e of C.current.keys())j.plots.has(e)||C.current.delete(e)},[j]);let ee=vn(),P=!f&&!ee,F=c(n,i),I=n.nodes.filter(t=>!e.visibleNodeIds||e.visibleNodeIds.includes(t.id)),L=e.visibleVoyageIds?new Set(e.visibleVoyageIds):void 0,R=e.showVoyages===!1?[]:(n.voyages??[]).filter(e=>!L||L.has(e.id)),z=R.reduce((e,t)=>e+t.stops.length,0),te=R.reduce((e,t)=>e+t.mcpCalls,0),B=(0,q.useMemo)(()=>new Map(n.nodes.map(e=>[e.id,m(n,e.id)])),[n]),ne=(0,q.useMemo)(()=>new Map(n.nodes.map(e=>[e.id,r(n,e.id)])),[n]),re=new Map(n.nodes.map(e=>[e.id,je(n,e.id)])),ie=new Set(I.map(e=>e.id)),ae=y?.type===`service`?y.service.nodeId:y?.type===`skill`?n.services.find(e=>e.id===y.skill.serviceId)?.nodeId:void 0,oe=JSON.stringify([...ie].sort()),se=(0,q.useMemo)(()=>Ae([...ie]),[oe]),ce=(0,q.useMemo)(()=>t(n.network,ie),[n.network,oe]),le={direct:0,derp:0,"peer-relay":0,offline:0,unknown:0};for(let e of n.network?.connections??[])le[e.kind]+=1;let ue=n.mode===`demo`?Date.parse(n.generatedAt):Date.now(),de=u?p(n,i,ie,ue):[];(0,q.useEffect)(()=>{try{let e=document.createElement(`canvas`),t=e.getContext(`webgl2`)||e.getContext(`webgl`);g(!!t),t?.getExtension(`WEBGL_lose_context`)?.loseContext()}catch{g(!1)}},[]);let fe=(0,Q.jsx)(An,{props:e,reason:h===null?`正在准备三维显示。`:_?`三维显示已中断，已切换到设备星图。`:`当前环境无法启用三维显示，已切换到设备星图。`});return(0,Q.jsx)(`div`,{ref:x,"data-testid":`universe-scene`,role:`region`,"aria-label":`能力宇宙三维空间；拖动旋转视角，滚轮缩放，触屏单指旋转、双指缩放或平移；单击星球查看指标，双击进入基地。当前服务入口 ${A.authority} 对应的设备为小太阳系中心；能与它直连的设备做小公转，整个星系绕 DERP 总中心做较慢的大公转。金色为观测的 DERP 中继路径，蓝色为直连，淡线为对等关系示意。细星环上每颗卫星代表一个服务能力，每个星点代表一个可见 Skill 包，点击星点阅读完整 Skill 文档。球面颜色显示项目存储占比，灰色为未探查或未归属。公转为示意。`,"data-projection":`perspective`,"data-sizing":`storage-volume`,"data-layout":`service-centered-galaxies`,"data-motion-profile":`independent-spatial-orbits-v10`,"data-label-mode":`proximity`,"data-device-count":n.nodes.length,"data-ring-radius":j.majorRadius.toFixed(4),"data-service-domain":A.authority,"data-service-center-node-id":A.nodeId,"data-system-count":j.systems.length,"data-local-orbit-radius":N?.minorRadius.toFixed(4)??`0`,"data-local-device-count":N?.nodeIds.length??0,"data-major-orbit-radius":j.majorRadius.toFixed(4),"data-layout-envelope":j.radius.toFixed(4),"data-central-relay-node-id":k?.nodeId,"data-orbiting-device-count":n.nodes.length-+!!k,"data-network-status":n.network?.status??`unavailable`,"data-observed-direct-connections":le.direct,"data-observed-relay-connections":le.derp,"data-content-model":`capability-satellites-skill-stars`,"data-capability-satellites":I.reduce((e,t)=>e+B.get(t.id).services.length,0),"data-skill-stars":I.reduce((e,t)=>e+B.get(t.id).skills.length,0),"data-orbit-hover":y?.type??``,"data-peer-connections":u?se.length:0,"data-highlighted-peer-connections":u?se.filter(({from:e,to:t})=>F.has(e)||F.has(t)).length:0,"data-voyage-count":R.length,"data-voyage-stop-count":z,"data-voyage-mcp-calls":te,"data-voyage-session-count":R.filter(e=>e.kind===`session`).length,"data-voyage-acp-count":R.filter(e=>e.kind===`acp`).length,"data-voyage-cycle-ms":n.refreshIntervalMs,"data-voyage-selected":i?.type===`voyage`?i.id:``,"data-effects-running":P?`true`:`false`,"data-animation-fps":30,onPointerDownCapture:e=>{w.current=!1,T.current={x:e.clientX,y:e.clientY,pointerId:e.pointerId}},onPointerMoveCapture:e=>{let t=T.current;t&&(e.pointerId!==t.pointerId||Math.hypot(e.clientX-t.x,e.clientY-t.y)>6)&&(w.current=!0),e.buttons&&w.current&&b(null);let n=e.currentTarget.getBoundingClientRect();D.current=e.pointerType===`touch`?null:{x:e.clientX-n.left,y:e.clientY-n.top,dragging:e.buttons!==0&&w.current}},onPointerLeave:()=>{D.current=null,b(null)},onPointerCancelCapture:()=>{w.current=!0,T.current=null,D.current=null},style:{width:`100%`,height:`100%`,position:`relative`,overflow:`hidden`,background:pt.background},children:h&&!_?(0,Q.jsxs)(bn,{fallback:(0,Q.jsx)(An,{props:e,reason:`三维素材加载失败，已切换到设备星图。`}),children:[(0,Q.jsxs)(E,{dpr:[1,1.5],frameloop:`never`,camera:{position:[...Tt.overviewOffset],fov:Tt.fov,near:.03,far:3e4},gl:{antialias:!0,alpha:!1,powerPreference:`low-power`},onPointerMissed:()=>{w.current||l(null)},style:{touchAction:`none`},children:[(0,Q.jsx)(`color`,{attach:`background`,args:[pt.background]}),(0,Q.jsx)(`ambientLight`,{intensity:.46,color:`#9fc5ea`}),(0,Q.jsx)(`hemisphereLight`,{args:[`#8ac5ec`,`#030b1b`,1.3]}),(0,Q.jsx)(`directionalLight`,{position:[-15,22,20],color:`#c9edff`,intensity:2.8}),(0,Q.jsx)(`directionalLight`,{position:[20,-4,-8],color:`#4784ff`,intensity:2.2}),(0,Q.jsx)(`pointLight`,{position:[-4,6,4],color:`#ffcf99`,intensity:75,distance:40,decay:2}),(0,Q.jsx)(Sn,{onFailure:()=>v(!0)}),(0,Q.jsx)(fn,{animate:P,element:x}),(0,Q.jsx)(xn,{layout:j,animate:P,time:S,positions:C}),(0,Q.jsx)(Dt,{resetKey:d,action:e.navAction,positions:C,sizes:re,ringRadius:j.radius,localSystem:N,selectedIds:F,orbitTime:S,sceneElement:x}),(0,Q.jsx)(vt,{animate:P}),(0,Q.jsx)(yt,{animate:P}),(0,Q.jsx)(tt,{layout:j,positions:C}),u&&(0,Q.jsxs)(Q.Fragment,{children:[(0,Q.jsx)(On,{connections:se,selected:F,positions:C,subdued:!!n.network}),(0,Q.jsx)(Dn,{connections:ce.direct,positions:C,opacity:.7,color:`#77dce9`}),(0,Q.jsx)(Dn,{connections:ce.derp,positions:C,opacity:.85,color:`#efbd70`})]}),de.map(e=>(0,Q.jsx)(kn,{event:e,positions:C,gestureMoved:w,onSelect:l},e.id)),(0,Q.jsx)(un,{voyages:R,positions:C,sizes:re,layoutRadius:j.radius,localNodeId:n.serviceNodeId??k?.nodeId,selectedId:i?.type===`voyage`?i.id:void 0,onSelect:l,animate:P,cycleStart:n.generatedAt,cycleMs:n.refreshIntervalMs}),I.map(t=>(0,Q.jsx)(wn,{node:t,plot:j.plots.get(t.id),radius:re.get(t.id),selected:F.has(t.id),contents:B.get(t.id),composition:ne.get(t.id),selectedServiceId:i?.type===`service`?i.id:void 0,selectedSkillId:i?.type===`skill`&&F.has(t.id)?i.id:void 0,animate:P,time:S,positions:C,gestureMoved:w,onSelect:l,onEnter:e.onEnterNode,onHover:b},t.id)),(0,Q.jsx)(Tn,{nodes:I,layout:j,sizes:re,elements:O,selected:F,positions:C,sceneElement:x,pointer:D})]}),(0,Q.jsx)(`div`,{style:{position:`absolute`,inset:0,pointerEvents:`none`,zIndex:2},children:I.map(t=>(0,Q.jsx)(En,{node:t,plot:j.plots.get(t.id),selected:F.has(t.id),entry:A.nodeId===t.id?A:void 0,system:j.systems.find(e=>e.nodeIds.includes(t.id)),relay:k?.nodeId===t.id?k:void 0,networkPath:n.network?o(n.network,t.id):void 0,contents:B.get(t.id),composition:ne.get(t.id),services:t.catalogAvailable||n.services.some(e=>e.nodeId===t.id)?n.services.filter(e=>e.nodeId===t.id).length:null,onSelect:l,onEnter:e.onEnterNode,elementRef:e=>{e?O.current.set(t.id,e):O.current.delete(t.id)}},t.id))}),y&&ae&&ie.has(ae)&&(0,Q.jsxs)(`div`,{role:`tooltip`,className:`universe-satellite-tooltip${y.type===`skill`?` universe-skill-tooltip`:``}`,style:{left:Math.max(8,Math.min((x.current?.clientWidth??1280)-220,y.clientX-(x.current?.getBoundingClientRect().left??0)+14)),top:Math.max(8,y.clientY-(x.current?.getBoundingClientRect().top??0)-54)},children:[(0,Q.jsx)(`strong`,{children:y.type===`skill`?y.skill.name:y.service.name}),(0,Q.jsx)(`span`,{children:y.type===`skill`?`Skill · 点击阅读文档`:`${y.service.methods.length} 个方法 · 点击查看能力`})]}),(0,Q.jsx)(`div`,{"aria-hidden":`true`,style:{position:`absolute`,inset:0,pointerEvents:`none`,boxShadow:`inset 0 0 130px #01040a88`,background:`radial-gradient(ellipse at 48% 48%, transparent 20%, #01061033 75%)`,zIndex:1}})]}):fe})}export{jn as default};