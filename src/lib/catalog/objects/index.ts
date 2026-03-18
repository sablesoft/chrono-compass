import type { Obj, ObjId } from '../types';

import { Sun } from './sun';
import { Earth } from './earth';
import { Moon } from './moon';
import { Mercury } from './mercury';
import { Venus } from './venus';
import { Mars } from './mars';
import { Jupiter } from './jupiter';
import { Saturn } from './saturn';
import { Uranus } from './uranus';
import { Neptune } from './neptune';
import { Pluto } from './pluto';
import {GalacticCenter} from "./galactic-center";
import { EclipticAxis } from './ecliptic-axis';
import { NorthCelestialPole } from './north-celestial-pole';
import { SouthCelestialPole } from './south-celestial-pole';
import { Acamar } from './stars/acamar';
import { Achernar } from './stars/achernar';
import { Acrux } from './stars/acrux';
import { Acubens } from './stars/acubens';
import { Adhara } from './stars/adhara';
import { Alcyone } from './stars/alcyone';
import { Aldebaran } from './stars/aldebaran';
import { Alderamin } from './stars/alderamin';
import { Aldhanab } from './stars/aldhanab';
import { Aldulfin } from './stars/aldulfin';
import { Alfard } from './stars/alfard';
import { Alfirk } from './stars/alfirk';
import { Algedi } from './stars/algedi';
import { Algieba } from './stars/algieba';
import { Algol } from './stars/algol';
import { Algorab } from './stars/algorab';
import { Alhena } from './stars/alhena';
import { Alioth } from './stars/alioth';
import { Aljanah } from './stars/aljanah';
import { Alkaid } from './stars/alkaid';
import { Alkes } from './stars/alkes';
import { Almach } from './stars/almach';
import { Alnair } from './stars/alnair';
import { Alphecca } from './stars/alphecca';
import { Alpheratz } from './stars/alpheratz';
import { Alpherg } from './stars/alpherg';
import { Alrescha } from './stars/alrescha';
import { Alsciaukat } from './stars/alsciaukat';
import { Alsephina } from './stars/alsephina';
import { Altair } from './stars/altair';
import { Ankaa } from './stars/ankaa';
import { Anser } from './stars/anser';
import { Antares } from './stars/antares';
import { Arcturus } from './stars/arcturus';
import { Arneb } from './stars/arneb';
import { Ascella } from './stars/ascella';
import { AsellusAustralis } from './stars/asellus-australis';
import { Ashlesha } from './stars/ashlesha';
import { Athebyne } from './stars/athebyne';
import { Atria } from './stars/atria';
import { Avior } from './stars/avior';
import { BabcockSStar } from './stars/babcock-s-star';
import { Bellatrix } from './stars/bellatrix';
import { Betelgeuse } from './stars/betelgeuse';
import { Bharani } from './stars/bharani';
import { Bibha } from './stars/bibha';
import { Brachium } from './stars/brachium';
import { Bubup } from './stars/bubup';
import { Canopus } from './stars/canopus';
import { Capella } from './stars/capella';
import { Caph } from './stars/caph';
import { Castor } from './stars/castor';
import { Ceibo } from './stars/ceibo';
import { Cervantes } from './stars/cervantes';
import { Chara } from './stars/chara';
import { Cih } from './stars/cih';
import { Citala } from './stars/citala';
import { Cocibolca } from './stars/cocibolca';
import { CorCaroli } from './stars/cor-caroli';
import { Cursa } from './stars/cursa';
import { Dabih } from './stars/dabih';
import { Dalim } from './stars/dalim';
import { Deltoton } from './stars/deltoton';
import { DenebAlgedi } from './stars/deneb-algedi';
import { DenebKaitos } from './stars/deneb-kaitos';
import { Deneb } from './stars/deneb';
import { Denebola } from './stars/denebola';
import { Diadem } from './stars/diadem';
import { Dschubba } from './stars/dschubba';
import { Dubhe } from './stars/dubhe';
import { Elkurud } from './stars/elkurud';
import { Elnath } from './stars/elnath';
import { Eltanin } from './stars/eltanin';
import { Emiw } from './stars/emiw';
import { Enif } from './stars/enif';
import { Errai } from './stars/errai';
import { Fomalhaut } from './stars/fomalhaut';
import { Gacrux } from './stars/gacrux';
import { Gienah } from './stars/gienah';
import { Gomeisa } from './stars/gomeisa';
import { Graffias } from './stars/graffias';
import { Gudja } from './stars/gudja';
import { Hadar } from './stars/hadar';
import { Hamal } from './stars/hamal';
import { Hoerikwaggo } from './stars/hoerikwaggo';
import { Hunahpu } from './stars/hunahpu';
import { Illyrian } from './stars/illyrian';
import { Imai } from './stars/imai';
import { Inquill } from './stars/inquill';
import { Intan } from './stars/intan';
import { Izar } from './stars/izar';
import { Kaffaljidhma } from './stars/kaffaljidhma';
import { Kamuy } from './stars/kamuy';
import { KapteynSStar } from './stars/kapteyn-s-star';
import { Karaka } from './stars/karaka';
import { KausAustralis } from './stars/kaus-australis';
import { Kitalpha } from './stars/kitalpha';
import { Kochab } from './stars/kochab';
import { Kornephoros } from './stars/kornephoros';
import { Kraz } from './stars/kraz';
import { LaSuperba } from './stars/la-superba';
import { Lacaille8760 } from './stars/lacaille-8760';
import { Lacaille9352 } from './stars/lacaille-9352';
import { LangExster } from './stars/lang-exster';
import { Lusitania } from './stars/lusitania';
import { LuytenSStar } from './stars/luyten-s-star';
import { Macondo } from './stars/macondo';
import { Mago } from './stars/mago';
import { Mahasim } from './stars/mahasim';
import { Markab } from './stars/markab';
import { Markeb } from './stars/markeb';
import { Maru } from './stars/maru';
import { Menkalinan } from './stars/menkalinan';
import { Menkar } from './stars/menkar';
import { Meridiana } from './stars/meridiana';
import { Miaplacidus } from './stars/miaplacidus';
import { Mimosa } from './stars/mimosa';
import { Mintaka } from './stars/mintaka';
import { Mirach } from './stars/mirach';
import { Miram } from './stars/miram';
import { Mirfak } from './stars/mirfak';
import { Mothallah } from './stars/mothallah';
import { Muphrid } from './stars/muphrid';
import { Naos } from './stars/naos';
import { Nenque } from './stars/nenque';
import { Nihal } from './stars/nihal';
import { Nunki } from './stars/nunki';
import { Nusakan } from './stars/nusakan';
import { Okab } from './stars/okab';
import { Paradys } from './stars/paradys';
import { Peacock } from './stars/peacock';
import { Phact } from './stars/phact';
import { Pherkad } from './stars/pherkad';
import { PhyllonKissinou } from './stars/phyllon-kissinou';
import { Pipit } from './stars/pipit';
import { Poerava } from './stars/poerava';
import { PolarisAustralis } from './stars/polaris-australis';
import { Polaris } from './stars/polaris';
import { Polis } from './stars/polis';
import { Pollux } from './stars/pollux';
import { Porrima } from './stars/porrima';
import { Praecipua } from './stars/praecipua';
import { Procyon } from './stars/procyon';
import { Rasalgethi } from './stars/rasalgethi';
import { Rasalhague } from './stars/rasalhague';
import { Rastaban } from './stars/rastaban';
import { RedRectangle } from './stars/red-rectangle';
import { Regulus } from './stars/regulus';
import { Rhombus } from './stars/rhombus';
import { Rigel } from './stars/rigel';
import { RigilKentaurus } from './stars/rigil-kentaurus';
import { Rotanev } from './stars/rotanev';
import { Sabik } from './stars/sabik';
import { Sadalmelik } from './stars/sadalmelik';
import { Sadalsuud } from './stars/sadalsuud';
import { Sadr } from './stars/sadr';
import { Samaya } from './stars/samaya';
import { Sargas } from './stars/sargas';
import { Sarin } from './stars/sarin';
import { Scheat } from './stars/scheat';
import { Schedar } from './stars/schedar';
import { Sham } from './stars/sham';
import { Shaula } from './stars/shaula';
import { Sheliak } from './stars/sheliak';
import { Sheratan } from './stars/sheratan';
import { Sirius } from './stars/sirius';
import { Skat } from './stars/skat';
import { Spica } from './stars/spica';
import { Stellio } from './stars/stellio';
import { Stribor } from './stars/stribor';
import { Sualocin } from './stars/sualocin';
import { Suhail } from './stars/suhail';
import { Sulafat } from './stars/sulafat';
import { Tarazed } from './stars/tarazed';
import { Tarf } from './stars/tarf';
import { Tengshe } from './stars/tengshe';
import { Tiaki } from './stars/tiaki';
import { Toliman } from './stars/toliman';
import { Tonatiuh } from './stars/tonatiuh';
import { Torcular } from './stars/torcular';
import { Tupi } from './stars/tupi';
import { Tureis } from './stars/tureis';
import { Ukdah } from './stars/ukdah';
import { Unukalhai } from './stars/unukalhai';
import { Uridim } from './stars/uridim';
import { Uruk } from './stars/uruk';
import { Uuba } from './stars/uuba';
import { Vega } from './stars/vega';
import { Vindemiatrix } from './stars/vindemiatrix';
import { Wazn } from './stars/wazn';
import { Wezen } from './stars/wezen';
import { Wurren } from './stars/wurren';
import { Xami } from './stars/xami';
import { YedPrior } from './stars/yed-prior';
import { Zhou } from './stars/zhou';
import { ZubenElakrab } from './stars/zuben-elakrab';
import { ZubenElschemali } from './stars/zuben-elschemali';
import { Zubenelgenubi } from './stars/zubenelgenubi';
import { CONSTELLATIONS } from './constellations';

const constellationObjects: Partial<Record<ObjId, Obj>> = Object.fromEntries(
    CONSTELLATIONS.map((item) => [item.id, item] as const)
) as Partial<Record<ObjId, Obj>>;

export const objects: Partial<Record<ObjId, Obj>> = {
    [Sun.id]: Sun,
    [Earth.id]: Earth,
    [Moon.id]: Moon,
    [Mercury.id]: Mercury,
    [Venus.id]: Venus,
    [Mars.id]: Mars,
    [Jupiter.id]: Jupiter,
    [Neptune.id]: Neptune,
    [Pluto.id]: Pluto,
    [Saturn.id]: Saturn,
    [Uranus.id]: Uranus,
    [GalacticCenter.id]: GalacticCenter,
    [EclipticAxis.id]: EclipticAxis,
    [NorthCelestialPole.id]: NorthCelestialPole,
    [SouthCelestialPole.id]: SouthCelestialPole,
    [Acamar.id]: Acamar,
    [Achernar.id]: Achernar,
    [Acrux.id]: Acrux,
    [Acubens.id]: Acubens,
    [Adhara.id]: Adhara,
    [Alcyone.id]: Alcyone,
    [Aldebaran.id]: Aldebaran,
    [Alderamin.id]: Alderamin,
    [Aldhanab.id]: Aldhanab,
    [Aldulfin.id]: Aldulfin,
    [Alfard.id]: Alfard,
    [Alfirk.id]: Alfirk,
    [Algedi.id]: Algedi,
    [Algieba.id]: Algieba,
    [Algol.id]: Algol,
    [Algorab.id]: Algorab,
    [Alhena.id]: Alhena,
    [Alioth.id]: Alioth,
    [Aljanah.id]: Aljanah,
    [Alkaid.id]: Alkaid,
    [Alkes.id]: Alkes,
    [Almach.id]: Almach,
    [Alnair.id]: Alnair,
    [Alphecca.id]: Alphecca,
    [Alpheratz.id]: Alpheratz,
    [Alpherg.id]: Alpherg,
    [Alrescha.id]: Alrescha,
    [Alsciaukat.id]: Alsciaukat,
    [Alsephina.id]: Alsephina,
    [Altair.id]: Altair,
    [Ankaa.id]: Ankaa,
    [Anser.id]: Anser,
    [Antares.id]: Antares,
    [Arcturus.id]: Arcturus,
    [Arneb.id]: Arneb,
    [Ascella.id]: Ascella,
    [AsellusAustralis.id]: AsellusAustralis,
    [Ashlesha.id]: Ashlesha,
    [Athebyne.id]: Athebyne,
    [Atria.id]: Atria,
    [Avior.id]: Avior,
    [BabcockSStar.id]: BabcockSStar,
    [Bellatrix.id]: Bellatrix,
    [Betelgeuse.id]: Betelgeuse,
    [Bharani.id]: Bharani,
    [Bibha.id]: Bibha,
    [Brachium.id]: Brachium,
    [Bubup.id]: Bubup,
    [Canopus.id]: Canopus,
    [Capella.id]: Capella,
    [Caph.id]: Caph,
    [Castor.id]: Castor,
    [Ceibo.id]: Ceibo,
    [Cervantes.id]: Cervantes,
    [Chara.id]: Chara,
    [Cih.id]: Cih,
    [Citala.id]: Citala,
    [Cocibolca.id]: Cocibolca,
    [CorCaroli.id]: CorCaroli,
    [Cursa.id]: Cursa,
    [Dabih.id]: Dabih,
    [Dalim.id]: Dalim,
    [Deltoton.id]: Deltoton,
    [DenebAlgedi.id]: DenebAlgedi,
    [DenebKaitos.id]: DenebKaitos,
    [Deneb.id]: Deneb,
    [Denebola.id]: Denebola,
    [Diadem.id]: Diadem,
    [Dschubba.id]: Dschubba,
    [Dubhe.id]: Dubhe,
    [Elkurud.id]: Elkurud,
    [Elnath.id]: Elnath,
    [Eltanin.id]: Eltanin,
    [Emiw.id]: Emiw,
    [Enif.id]: Enif,
    [Errai.id]: Errai,
    [Fomalhaut.id]: Fomalhaut,
    [Gacrux.id]: Gacrux,
    [Gienah.id]: Gienah,
    [Gomeisa.id]: Gomeisa,
    [Graffias.id]: Graffias,
    [Gudja.id]: Gudja,
    [Hadar.id]: Hadar,
    [Hamal.id]: Hamal,
    [Hoerikwaggo.id]: Hoerikwaggo,
    [Hunahpu.id]: Hunahpu,
    [Illyrian.id]: Illyrian,
    [Imai.id]: Imai,
    [Inquill.id]: Inquill,
    [Intan.id]: Intan,
    [Izar.id]: Izar,
    [Kaffaljidhma.id]: Kaffaljidhma,
    [Kamuy.id]: Kamuy,
    [KapteynSStar.id]: KapteynSStar,
    [Karaka.id]: Karaka,
    [KausAustralis.id]: KausAustralis,
    [Kitalpha.id]: Kitalpha,
    [Kochab.id]: Kochab,
    [Kornephoros.id]: Kornephoros,
    [Kraz.id]: Kraz,
    [LaSuperba.id]: LaSuperba,
    [Lacaille8760.id]: Lacaille8760,
    [Lacaille9352.id]: Lacaille9352,
    [LangExster.id]: LangExster,
    [Lusitania.id]: Lusitania,
    [LuytenSStar.id]: LuytenSStar,
    [Macondo.id]: Macondo,
    [Mago.id]: Mago,
    [Mahasim.id]: Mahasim,
    [Markab.id]: Markab,
    [Markeb.id]: Markeb,
    [Maru.id]: Maru,
    [Menkalinan.id]: Menkalinan,
    [Menkar.id]: Menkar,
    [Meridiana.id]: Meridiana,
    [Miaplacidus.id]: Miaplacidus,
    [Mimosa.id]: Mimosa,
    [Mintaka.id]: Mintaka,
    [Mirach.id]: Mirach,
    [Miram.id]: Miram,
    [Mirfak.id]: Mirfak,
    [Mothallah.id]: Mothallah,
    [Muphrid.id]: Muphrid,
    [Naos.id]: Naos,
    [Nenque.id]: Nenque,
    [Nihal.id]: Nihal,
    [Nunki.id]: Nunki,
    [Nusakan.id]: Nusakan,
    [Okab.id]: Okab,
    [Paradys.id]: Paradys,
    [Peacock.id]: Peacock,
    [Phact.id]: Phact,
    [Pherkad.id]: Pherkad,
    [PhyllonKissinou.id]: PhyllonKissinou,
    [Pipit.id]: Pipit,
    [Poerava.id]: Poerava,
    [PolarisAustralis.id]: PolarisAustralis,
    [Polaris.id]: Polaris,
    [Polis.id]: Polis,
    [Pollux.id]: Pollux,
    [Porrima.id]: Porrima,
    [Praecipua.id]: Praecipua,
    [Procyon.id]: Procyon,
    [Rasalgethi.id]: Rasalgethi,
    [Rasalhague.id]: Rasalhague,
    [Rastaban.id]: Rastaban,
    [RedRectangle.id]: RedRectangle,
    [Regulus.id]: Regulus,
    [Rhombus.id]: Rhombus,
    [Rigel.id]: Rigel,
    [RigilKentaurus.id]: RigilKentaurus,
    [Rotanev.id]: Rotanev,
    [Sabik.id]: Sabik,
    [Sadalmelik.id]: Sadalmelik,
    [Sadalsuud.id]: Sadalsuud,
    [Sadr.id]: Sadr,
    [Samaya.id]: Samaya,
    [Sargas.id]: Sargas,
    [Sarin.id]: Sarin,
    [Scheat.id]: Scheat,
    [Schedar.id]: Schedar,
    [Sham.id]: Sham,
    [Shaula.id]: Shaula,
    [Sheliak.id]: Sheliak,
    [Sheratan.id]: Sheratan,
    [Sirius.id]: Sirius,
    [Skat.id]: Skat,
    [Spica.id]: Spica,
    [Stellio.id]: Stellio,
    [Stribor.id]: Stribor,
    [Sualocin.id]: Sualocin,
    [Suhail.id]: Suhail,
    [Sulafat.id]: Sulafat,
    [Tarazed.id]: Tarazed,
    [Tarf.id]: Tarf,
    [Tengshe.id]: Tengshe,
    [Tiaki.id]: Tiaki,
    [Toliman.id]: Toliman,
    [Tonatiuh.id]: Tonatiuh,
    [Torcular.id]: Torcular,
    [Tupi.id]: Tupi,
    [Tureis.id]: Tureis,
    [Ukdah.id]: Ukdah,
    [Unukalhai.id]: Unukalhai,
    [Uridim.id]: Uridim,
    [Uruk.id]: Uruk,
    [Uuba.id]: Uuba,
    [Vega.id]: Vega,
    [Vindemiatrix.id]: Vindemiatrix,
    [Wazn.id]: Wazn,
    [Wezen.id]: Wezen,
    [Wurren.id]: Wurren,
    [Xami.id]: Xami,
    [YedPrior.id]: YedPrior,
    [Zhou.id]: Zhou,
    [ZubenElakrab.id]: ZubenElakrab,
    [ZubenElschemali.id]: ZubenElschemali,
    [Zubenelgenubi.id]: Zubenelgenubi,
    ...constellationObjects
} satisfies Partial<Record<ObjId, Obj>>;
