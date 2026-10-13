# SysMaster

SysMaster est une application de bureau Electron pour surveiller et administrer une machine Linux depuis une interface React. Elle rassemble les métriques système, les outils de contrôle et un serveur MCP local.

## Fonctions

- Tableau de bord configurable, galerie de widgets, métriques CPU/mémoire, stockage, réseau, températures et GPU.
- Règles automatiques avec notifications ou déclenchement de macros.
- Consultation et contrôle des processus, services systemd, applications de bureau, conteneurs Docker, disques et utilisateurs.
- Journal système, audit des actions, réglage de la fréquence des relevés et import/export de la configuration.
- Serveur MCP en JSON-RPC sur `stdio`, avec des outils de lecture et de contrôle utilisables par un client compatible.

## Prérequis

- Linux avec systemd; Debian ou Ubuntu sont les environnements visés par les commandes de gestion des paquets.
- Node.js et npm pour le développement.
- Les outils système utilisés dépendent des fonctions : `dpkg-query`, `systemctl`, `journalctl`, `ss`, `ping`, `dig`, `udisksctl` et `sensors`. Docker est nécessaire uniquement pour gérer les conteneurs. Les fonctions liées à un outil indisponible peuvent échouer.
- Polkit est utilisé pour les opérations nécessitant des privilèges. Lancez l'application avec votre compte normal, pas avec `sudo`.

## Développement

```bash
git clone https://github.com/Vicky197709/sysmaaster.git
cd sysmaaster
npm ci
npm run dev
```

## Commandes

```bash
npm test           # tests Vitest
npm run typecheck  # vérification TypeScript
npm run build      # compile l'application dans out/
npm run dist       # construit les paquets Linux .deb et AppImage dans dist/
```

## Serveur MCP

Compilez d'abord l'application, puis lancez le serveur en mode stdio :

```bash
npm run build
npm run -s mcp
```

Exemple de configuration pour un client MCP qui prend en charge `command` et `args` :

```json
{
  "mcpServers": {
    "sysmaster": {
      "command": "npm",
      "args": ["--prefix", "/chemin/vers/sysmaaster", "run", "-s", "mcp"]
    }
  }
}
```

Remplacez le chemin par celui du dépôt sur votre machine. Le client communique avec SysMaster par `stdin`/`stdout`; les diagnostics sont écrits sur `stderr`.

## Sécurité

Les opérations de contrôle peuvent arrêter des processus, modifier des services, monter des disques, piloter Docker ou lancer des macros. Elles passent par des validations et sont inscrites dans le journal d'audit; les demandes de privilèges passent par Polkit. Le mode expert est désactivé par défaut et autorise notamment les commandes shell dans les macros ainsi que `SIGKILL`.

Le serveur MCP expose lui aussi des outils de contrôle. Ne le connectez qu'à des clients de confiance et vérifiez les actions avant de les autoriser. Les tableaux de bord, règles et macros sont enregistrés dans les données utilisateur de l'application; ils peuvent être exportés ou importés depuis les paramètres.