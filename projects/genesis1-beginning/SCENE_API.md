# Shared scene API

Each scenes/*.js registers a function on window.G1_SCENES using a stable semantic family name. Script executes at build; no module imports. Root dispatches based on an explicit scene-plan mapping. Handler signature function(ctx).

ctx: {tl,phrase,words,nodes,start,end,scene,camera,back,front,type,theme,E,place,row,reveal,rect,ring,path,glyphs,beat}

- tl: single shared pausedGSAPtimeline; all timing absolute songseconds. start=phrase.start, end=nextphrase.start (or songend). phrase.end=lastvocalend.
- words: canonical {id,text,start,end}; nodes sameindex HTML spans, opacity0 initially. Rootcontrols stageopacity and safe defaultwordreveal whenhandlerdoesn'toverride; words mustnotbe hiddenbeforetheirword.end.
- scene has camera child with back(z0),front(z1),type(z3). shape layersareunderprimarytype. May createownlayersifneededpreservetype.
- theme={ink:'#10100f',bone:'#f0e4cc',rust:'#a45636',amber:'#c59659',muted:'#665447'}
- E(tag,className,parent,style={}) => element; styleCSS object, numbers usepxyourself.
- place(index,x,y,size,{font='condensed',color=theme.bone,rotation=0,scaleX=1}={}) updates nodeCSS positions/fonts/size, GSAPinitialrotation ifspecified; returnsnode. font:condensed(Bebas),heavy(Archivo),serif(EBGaramonditalic),mono(IBM PlexMono onceprovided). nodes have _width,_height aftermeasurement. Placeiscalledatsetup, notruntime.
- row(indices,{x=140,y=400,maxWidth=1640,size=160,font='condensed',color=theme.bone,gap=20,align='left'}={}) proportionallyshrinksallfontsize ifrowtoo wide, returnsnodes. Treatthisaslayoututilitynotrepeatedscenechoreography.
- reveal(index,{from={y:20},to={},duration=.12,ease='power3.out'}={}) setsopacity1 exactlyatwords[index].start; transformfromenterstatebacktoplacepose. Userwantsvocalssynced; don'tdelaystartsforstagger. defaultrootrevealifnorevealcalledisopacity1atcuewithsubtle.06s y12settle. Node _customReveal flagset.
- rect(parent,x,y,w,h,color=theme.rust) => absolutelyplaced div
- ring(parent,x,y,diameter,stroke=8,color=theme.rust) => bordercircle
- path(parent,d,{stroke=theme.rust,width=8,fill='none',viewBox='0 0 1920 1080'}={}) => SVGpathinsidefullframesvg; returnspath(dashdrawviaGSAPattr)
- glyphs(index) splitcanonicalnodeintosingleletterspans; onlyuseforoneherowordatatime. ParentkeepswordId; childspansdisplayinline-block. Returnletters; rootcanonicalrevealstillapplies.
- beat(near,window=.10) => nearestmeasuredattackwithinwindow, elsenear. Onlygraphicaccents; neverretimewordcues.

Use1920×1080canvas; readabletextboxboundsnormallyx100..1820,y100..950. Intentionalbackgroundoverflowmaysetdataset.layoutAllowOverflow=''. Forheroheldphrasesmultiplewordrowsareallowedbutdon'tmakethattheentirefamily. Neverinventextralyrictext. Supportinggeometrycancontaintitle/contextonlyroot-approved. Generatepaths/geometrywithdeterministic indexformula, neverMath.random/loopsusingclocks. Defaultstagefadeallowsbriefphrasecontinuity. Handlercananimatecameraandshapecontinuouslyoverentirescene, butkeepreadabilityatvocalcueandthroughwordend. Effectsneednotallbeenter/exit: meaningshouldchangecompositionitself.

Each handler needs metadata in exported window.G1_SCENE_META[family]={principle,lyrics,distinctMechanic}; writea mappingproposal JSON with intake line numbers. Rootchoosesfinalphrasesafteralignment. Rootowns composition/build/media/validation,opening(first30s),outro(final3lines).
