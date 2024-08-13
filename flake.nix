{
  description = "MServe CLI tool";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages.default = pkgs.buildNpmPackage {
          name = "mserve";
          buildInputs = [ pkgs.nodejs_20 ];
          nativeBuildInputs = [ pkgs.installShellFiles ];
          src = self;
          npmDepsHash = "sha256-fFHLUFXl3gxsvMVCzh3VzBrOEH80TobIVkCofkO/WtE=";

          postInstall = ''
            installShellCompletion --cmd mserve \
              --zsh <(SHELL=zsh $out/bin/mserve completion) \
              --bash <(SHELL=bash $out/bin/mserve completion)
          '';
        };

        devShells.default = pkgs.mkShell { inputsFrom = [ self.packages.${system}.default ]; };
      }
    );
}
