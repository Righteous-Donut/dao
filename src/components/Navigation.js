import React from "react";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import Navbar from 'react-bootstrap/Navbar';

import logo from '../logo.png';

const Navigation = ({ account }) => {
  return (
    <Navbar className='my-3'>
      <img
        alt="logo"
        src={logo}
        width="40"
        height="40"
        className="d-inline-block align-top mx-3"
      />
      <div className="top-right-controls" style={{ position: "absolute", top: "1rem", right: "1rem", display: "flex", gap: "1rem" }}>
        <ConnectButton showBalance={false} chainStatus="name" accountStatus="address" />
      </div>
      <Navbar.Brand href="#">EASY-DAO</Navbar.Brand>
      <Navbar.Collapse className="justify-content-end">
        
      </Navbar.Collapse>
    </Navbar>
  );
}

export default Navigation;
