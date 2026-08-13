import type { AccountConfig } from "@/types/social";

interface MinisterAccountSeed {
  name: string;
  fullName?: string;
  position: string;
  ministry: string;
  instagramUsername: string;
  xUsername: string;
  extraAliases?: string[];
}

const ministers: MinisterAccountSeed[] = [
  {
    name: "Claudio Alvarado",
    fullName: "Claudio Alvarado Andrade",
    position: "Ministro del Interior y Segegob (Biministro)",
    ministry: "Interior y Segegob",
    instagramUsername: "ministroalvarado",
    xUsername: "Ministro_Alv",
  },
  {
    name: "Francisco Pérez Mackenna",
    position: "Ministro de Relaciones Exteriores",
    ministry: "Relaciones Exteriores",
    instagramUsername: "ministroperezmackenna",
    xUsername: "MinPerezMac",
  },
  {
    name: "Fernando Barros",
    fullName: "Fernando Barros Tocornal",
    position: "Ministro de Defensa Nacional",
    ministry: "Defensa Nacional",
    instagramUsername: "ministrobarros",
    xUsername: "",
  },
  {
    name: "Jorge Quiroz",
    fullName: "Jorge Quiroz Castro",
    position: "Ministro de Hacienda",
    ministry: "Hacienda",
    instagramUsername: "ministroquiroz",
    xUsername: "MinistroQuiroz",
  },
  {
    name: "Martín Arrau",
    fullName: "Martín Arrau García-Huidobro",
    position: "Ministro de Seguridad Pública",
    ministry: "Seguridad Pública",
    instagramUsername: "martin.arrau",
    xUsername: "martinarrau",
  },
  {
    name: "José García Ruminot",
    position: "Ministro Secretaría General de la Presidencia",
    ministry: "Secretaría General de la Presidencia",
    instagramUsername: "jgarciaruminot",
    xUsername: "jgarciaruminot",
  },
  {
    name: "Daniel Mas",
    fullName: "Daniel Mas Valdés",
    position: "Ministro de Economía y Minería (Biministro)",
    ministry: "Economía y Minería",
    instagramUsername: "danielmasvaldes",
    xUsername: "DanielMasValdes",
  },
  {
    name: "María Jesús Wulf",
    fullName: "María Jesús Wulf Le May",
    position: "Ministra de Desarrollo Social y Familia",
    ministry: "Desarrollo Social y Familia",
    instagramUsername: "ministrawulf",
    xUsername: "MinistraWulf",
  },
  {
    name: "María Paz Arzola",
    fullName: "María Paz Arzola González",
    position: "Ministra de Educación",
    ministry: "Educación",
    instagramUsername: "ministraarzola",
    xUsername: "MPArzola",
  },
  {
    name: "Fernando Rabat",
    fullName: "Fernando Rabat Celis",
    position: "Ministro de Justicia y Derechos Humanos",
    ministry: "Justicia y Derechos Humanos",
    instagramUsername: "ministrorabat",
    xUsername: "",
  },
  {
    name: "Tomás Rau",
    fullName: "Tomás Rau Binder",
    position: "Ministro del Trabajo y Previsión Social",
    ministry: "Trabajo y Previsión Social",
    instagramUsername: "ministrorau",
    xUsername: "MinistroRau",
  },
  {
    name: "Louis de Grange",
    fullName: "Louis de Grange Concha",
    position: "Ministro de Obras Públicas y Transportes (Biministro)",
    ministry: "Obras Públicas y Transportes",
    instagramUsername: "ministrodegrange",
    xUsername: "louisdegrange",
  },
  {
    name: "May Chomali",
    fullName: "May Chomali Garib",
    position: "Ministra de Salud",
    ministry: "Salud",
    instagramUsername: "ministrachomali",
    xUsername: "MinistraChomali",
  },
  {
    name: "Iván Poduje",
    fullName: "Iván Poduje Capdeville",
    position: "Ministro de Vivienda y Urbanismo",
    ministry: "Vivienda y Urbanismo",
    instagramUsername: "ipoduje",
    xUsername: "MinistroPoduje",
  },
  {
    name: "Jaime Campos",
    fullName: "Jaime Campos Quiroga",
    position: "Ministro de Agricultura",
    ministry: "Agricultura",
    instagramUsername: "ministrojaimecampos",
    xUsername: "MinistroCampos",
  },
  {
    name: "Catalina Parot",
    fullName: "Catalina Parot Donoso",
    position: "Ministra de Bienes Nacionales",
    ministry: "Bienes Nacionales",
    instagramUsername: "ministraparot",
    xUsername: "catalinaparot",
  },
  {
    name: "Ximena Rincón",
    fullName: "Ximena Rincón González",
    position: "Ministra de Energía",
    ministry: "Energía",
    instagramUsername: "ximenarincon",
    xUsername: "ximerincon",
  },
  {
    name: "Francisca Toledo",
    fullName: "Francisca Toledo Echegaray",
    position: "Ministra del Medio Ambiente",
    ministry: "Medio Ambiente",
    instagramUsername: "ministratoledo",
    xUsername: "MinistraToledo",
  },
  {
    name: "Natalia Duco",
    fullName: "Natalia Duco Soler",
    position: "Ministra del Deporte",
    ministry: "Deporte",
    instagramUsername: "nataliaduco",
    xUsername: "NataliaDucoSole",
  },
  {
    name: "Judith Marín",
    fullName: "Judith Marín Morales",
    position: "Ministra de la Mujer y Equidad de Género",
    ministry: "Mujer y Equidad de Género",
    instagramUsername: "judithmarinm",
    xUsername: "MarinJudithM",
  },
  {
    name: "Francisco Undurraga",
    fullName: "Francisco Undurraga Gazitúa",
    position: "Ministro de las Culturas, Artes y Patrimonio",
    ministry: "Culturas, Artes y Patrimonio",
    instagramUsername: "undurragapancho",
    xUsername: "Min_Undurraga",
    extraAliases: ["@Panchoundurraga"],
  },
  {
    name: "Ximena Lincolao",
    fullName: "Ximena Lincolao Pilquián",
    position: "Ministra de Ciencia, Tecnología e Innovación",
    ministry: "Ciencia, Tecnología e Innovación",
    instagramUsername: "ximenalincolao",
    xUsername: "MinLincolao",
  },
];

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const ministerAccounts: AccountConfig[] = ministers.map((minister) => ({
  id: slug(minister.fullName ?? minister.name),
  name: minister.name,
  position: minister.position,
  ministry: minister.ministry,
  instagramUsername: minister.instagramUsername,
  xUsername: minister.xUsername,
  accountType: "minister",
  aliases: [
    minister.name,
    ...(minister.fullName ? [minister.fullName] : []),
    (minister.fullName ?? minister.name).split(" ").at(-1) ?? minister.name,
    `@${minister.instagramUsername}`,
    ...(minister.xUsername ? [`@${minister.xUsername}`] : []),
    ...(minister.extraAliases ?? []),
  ],
  active: true,
}));

const institutionalAccounts: AccountConfig[] = [
  {
    id: "ministerio-defensa-nacional",
    name: "Ministerio de Defensa Nacional",
    position: "Cuenta institucional",
    ministry: "Defensa Nacional",
    accountType: "institutional",
    xUsername: "mindefchile",
    instagramUsername: "",
    aliases: ["Ministerio de Defensa", "Mindef Chile", "@mindefchile"],
    active: true,
  },
  {
    id: "ministerio-justicia-derechos-humanos",
    name: "Ministerio de Justicia y Derechos Humanos",
    position: "Cuenta institucional",
    ministry: "Justicia y Derechos Humanos",
    accountType: "institutional",
    xUsername: "MinjuDDHH",
    instagramUsername: "",
    aliases: ["Ministerio de Justicia", "Minjusticia", "@MinjuDDHH"],
    active: true,
  },
];

export const defaultAccounts: AccountConfig[] = [
  ...ministerAccounts,
  ...institutionalAccounts,
];
