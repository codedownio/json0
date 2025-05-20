{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/release-24.11";
  inputs.nixpkgsMaster.url = "github:NixOS/nixpkgs/master";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, nixpkgsMaster, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" ] (system:
      let
        pkgs = import nixpkgs { inherit system; };
        pkgsMaster = import nixpkgsMaster { inherit system; };
      in
        {
          devShells = {
            default = pkgs.mkShell {
              buildInputs = [pkgs.nodejs];
            };
          };
          packages = {
            test = pkgs.writeShellScriptBin "json0-test" ''
              export NIX_PATH=nixpkgs=${pkgsMaster.path}
              # TODO
            '';
          };
        });
}
