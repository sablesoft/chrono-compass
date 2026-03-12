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
import { Sirius } from './sirius';
import { Polaris } from './polaris';
import { Betelgeuse } from './betelgeuse';
import { Antares } from './antares';
import { Deneb } from './deneb';
import { Altair } from './altair';
import { Nunki } from './nunki';
import { Acrux } from './acrux';
import { Mimosa } from './mimosa';
import { Gacrux } from './gacrux';
import { Imai } from './imai';
import { Vega } from './vega';
import { Pollux } from './pollux';
import { Aldebaran } from './aldebaran';
import { Arcturus } from './arcturus';
import { Achernar } from './achernar';
import { Alnair } from './alnair';
import { KausAustralis } from './kaus-australis';
import { Spica } from './spica';
import { Regulus } from './regulus';
import { Dubhe } from './dubhe';
import { Castor } from './castor';
import { Capella } from './capella';
import { Mirfak } from './mirfak';
import { Hamal } from './hamal';
import { Alpheratz } from './alpheratz';
import { Shaula } from './shaula';
import { Menkar } from './menkar';
import { Denebola } from './denebola';
import { Mintaka } from './mintaka';
import { Avior } from './avior';
import { Markab } from './markab';
import { DenebKaitos } from './deneb-kaitos';
import { Acamar } from './acamar';
import { Kochab } from './kochab';
import { Acubens } from './acubens';
import { Alfard } from './alfard';
import { ZubenElschemali } from './zuben-elschemali';
import { ZubenElakrab } from './zuben-elakrab';
import { Polis } from './polis';
import { Fomalhaut } from './fomalhaut';
import { Rasalhague } from './rasalhague';
import { Sabik } from './sabik';
import { Sargas } from './sargas';
import { Dschubba } from './dschubba';
import { Graffias } from './graffias';
import { Hadar } from './hadar';
import { Adhara } from './adhara';

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
} satisfies Partial<Record<ObjId, Obj>>;
