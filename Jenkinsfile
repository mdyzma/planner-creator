// Self-hosted CI/CD (docs/operations/deploy-subdomain.md, "Jenkins and Gitea"): the same checks
// as .github/workflows/ci.yml, then a deploy of the tested commit to the Proxmox container.
//
// Jenkins settings (Manage Jenkins → System → Global properties → Environment variables):
//   YAPCO_DEPLOY_HOST  the container's address, e.g. yapco.lan or 192.168.1.50 (empty: no deploy)
//   YAPCO_REPO         what the container fetches, e.g. http://gitea.lan:3000/mdyzma/yapco.git
//   YAPCO_ORIGIN       the public address, e.g. https://planner.example.com (kept out of the repo)
// Credentials: an "SSH Username with private key" with the id yapco-deploy (user root).
//
// Runs on the Jenkins machine itself, which needs once (as root, Debian 12):
//   curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs
//   apt-get install -y git chromium fonts-dejavu-core fonts-liberation openssh-client
//   corepack enable
pipeline {
  agent any

  options {
    timeout(time: 45, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  // Gitea pull-mirrors GitHub; poll it, since mirror syncs may not send webhooks.
  triggers {
    pollSCM('H/5 * * * *')
  }

  environment {
    CI = 'true'
    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    // No usage telemetry from Turborepo or Next.js (YAPCO itself has no analytics either).
    TURBO_TELEMETRY_DISABLED = '1'
    NEXT_TELEMETRY_DISABLED = '1'
    CHROME_PATH = '/usr/bin/chromium'
  }

  stages {
    stage('Set up') {
      steps {
        sh '''
          node --version
          "$CHROME_PATH" --version
          pnpm --version
          pnpm install --frozen-lockfile
        '''
      }
    }

    stage('Checks') {
      steps {
        sh 'pnpm lint'
        sh 'pnpm format:check'
        sh 'pnpm typecheck'
        // Two packages at a time: the Jenkins machine has 2 CPUs.
        sh 'pnpm test --concurrency=2'
      }
    }

    stage('Build') {
      steps {
        sh 'pnpm build'
      }
    }

    stage('PDF and page checks in Chromium') {
      steps {
        sh 'pnpm --filter @planner/export-node test:e2e'
      }
    }

    stage('Deploy') {
      when {
        allOf {
          expression { env.BRANCH_NAME == null || env.BRANCH_NAME == 'main' }
          expression { return (env.YAPCO_DEPLOY_HOST ?: '').trim() != '' }
        }
      }
      steps {
        sshagent(credentials: ['yapco-deploy']) {
          // Runs the install script from this checkout, for exactly the commit tested above.
          sh '''
            ssh -o StrictHostKeyChecking=accept-new "root@$YAPCO_DEPLOY_HOST" \
              "YAPCO_REPO='${YAPCO_REPO:-https://github.com/mdyzma/yapco.git}' YAPCO_ORIGIN='${YAPCO_ORIGIN:-}' YAPCO_COMMIT='$GIT_COMMIT' sh -s" \
              < deploy/proxmox/install.sh
          '''
        }
      }
    }
  }

  post {
    always {
      deleteDir()
    }
  }
}
