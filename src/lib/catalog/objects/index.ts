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
import { Sirius } from './stars/sirius';
import { Polaris } from './stars/polaris';
import { Betelgeuse } from './stars/betelgeuse';
import { Antares } from './stars/antares';
import { Deneb } from './stars/deneb';
import { Altair } from './stars/altair';
import { Nunki } from './stars/nunki';
import { Acrux } from './stars/acrux';
import { Mimosa } from './stars/mimosa';
import { Gacrux } from './stars/gacrux';
import { Imai } from './stars/imai';
import { Vega } from './stars/vega';
import { Pollux } from './stars/pollux';
import { Aldebaran } from './stars/aldebaran';
import { Arcturus } from './stars/arcturus';
import { Achernar } from './stars/achernar';
import { Alnair } from './stars/alnair';
import { KausAustralis } from './stars/kaus-australis';
import { Spica } from './stars/spica';
import { Regulus } from './stars/regulus';
import { Dubhe } from './stars/dubhe';
import { Castor } from './stars/castor';
import { Capella } from './stars/capella';
import { Mirfak } from './stars/mirfak';
import { Hamal } from './stars/hamal';
import { Alpheratz } from './stars/alpheratz';
import { Shaula } from './stars/shaula';
import { Menkar } from './stars/menkar';
import { Denebola } from './stars/denebola';
import { Mintaka } from './stars/mintaka';
import { Avior } from './stars/avior';
import { Markab } from './stars/markab';
import { DenebKaitos } from './stars/deneb-kaitos';
import { Acamar } from './stars/acamar';
import { Kochab } from './stars/kochab';
import { Acubens } from './stars/acubens';
import { Alfard } from './stars/alfard';
import { ZubenElschemali } from './stars/zuben-elschemali';
import { ZubenElakrab } from './stars/zuben-elakrab';
import { Polis } from './stars/polis';
import { Fomalhaut } from './stars/fomalhaut';
import { Rasalhague } from './stars/rasalhague';
import { Sabik } from './stars/sabik';
import { Sargas } from './stars/sargas';
import { Dschubba } from './stars/dschubba';
import { Graffias } from './stars/graffias';
import { Hadar } from './stars/hadar';
import { Adhara } from './stars/adhara';
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
    [Sirius.id]: Sirius,
    [Polaris.id]: Polaris,
    [Betelgeuse.id]: Betelgeuse,
    [Antares.id]: Antares,
    [Deneb.id]: Deneb,
    [Altair.id]: Altair,
    [Nunki.id]: Nunki,
    [Acrux.id]: Acrux,
    [Mimosa.id]: Mimosa,
    [Gacrux.id]: Gacrux,
    [Imai.id]: Imai,
    [Vega.id]: Vega,
    [Pollux.id]: Pollux,
    [Aldebaran.id]: Aldebaran,
    [Arcturus.id]: Arcturus,
    [Achernar.id]: Achernar,
    [Alnair.id]: Alnair,
    [KausAustralis.id]: KausAustralis,
    [Spica.id]: Spica,
    [Regulus.id]: Regulus,
    [Dubhe.id]: Dubhe,
    [Castor.id]: Castor,
    [Capella.id]: Capella,
    [Mirfak.id]: Mirfak,
    [Hamal.id]: Hamal,
    [Alpheratz.id]: Alpheratz,
    [Shaula.id]: Shaula,
    [Menkar.id]: Menkar,
    [Denebola.id]: Denebola,
    [Mintaka.id]: Mintaka,
    [Avior.id]: Avior,
    [Markab.id]: Markab,
    [DenebKaitos.id]: DenebKaitos,
    [Acamar.id]: Acamar,
    [Kochab.id]: Kochab,
    [Acubens.id]: Acubens,
    [Alfard.id]: Alfard,
    [ZubenElschemali.id]: ZubenElschemali,
    [ZubenElakrab.id]: ZubenElakrab,
    [Polis.id]: Polis,
    [Fomalhaut.id]: Fomalhaut,
    [Rasalhague.id]: Rasalhague,
    [Sabik.id]: Sabik,
    [Sargas.id]: Sargas,
    [Dschubba.id]: Dschubba,
    [Graffias.id]: Graffias,
    [Hadar.id]: Hadar,
    [Adhara.id]: Adhara,
    ...constellationObjects
} satisfies Partial<Record<ObjId, Obj>>;
