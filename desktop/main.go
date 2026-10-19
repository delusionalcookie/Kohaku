package main

import (
	"embed"
	"fmt"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
)

//go:embed all:site
var site embed.FS

func main() {
	_ = mime.AddExtensionType(".js", "text/javascript")
	_ = mime.AddExtensionType(".webp", "image/webp")
	_ = mime.AddExtensionType(".svg", "image/svg+xml")

	root, err := fs.Sub(site, "site")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:47321")
	if err != nil {
		listener, err = net.Listen("tcp", "127.0.0.1:0")
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	url := "http://" + listener.Addr().String() + "/"
	fmt.Println("Kohaku is open at", url)
	fmt.Println("Close this window to quit.")
	openBrowser(url)

	if err := http.Serve(listener, http.FileServer(http.FS(root))); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
